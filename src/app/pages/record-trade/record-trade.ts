import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { CurrencyCode, MarketKind, MarketQuote, MarketSearchResult, Position, Price, TradePayload, TradeResult, TradeSide } from '../../models';
import { MoneyPipe, currencySymbol } from '../../utils/money';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-record-trade',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './record-trade.html'
})
export class RecordTradeComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly tickersList = signal<Price[]>([]);
  readonly loadingTickers = signal<boolean>(false);

  // Multi-market: which market this trade belongs to. CSX = the existing
  // riel dropdown; US = a Finnhub symbol search; GOLD_KH = local gold (chi).
  market: MarketKind = 'CSX';
  readonly usResults = signal<MarketSearchResult[]>([]);
  readonly searchingSymbols = signal(false);
  readonly quoteLoading = signal(false);
  readonly GOLD_SYMBOL = 'XAU-KH';
  /** Last quote fetched for a US/gold symbol (CSX prices come from the ticker list). */
  readonly latestQuote = signal<MarketQuote | null>(null);

  /** Mobile-only: whether the position panel accordion is expanded. */
  readonly mobileBalanceOpen = signal(false);

  tradeTicker = '';
  tradeSide: TradeSide = 'BUY';
  tradePrice = 0;
  tradeQty = 0;
  tradeCommission = 0;
  isCommissionManual = false;
  readonly today = new Date().toISOString().split('T')[0];
  tradeDate = this.today;

  get currency(): CurrencyCode {
    return this.market === 'CSX' ? 'KHR' : 'USD';
  }
  /** Inline unit label used across the form ("riel" / "USD"). */
  get currencyUnit(): string {
    return this.market === 'CSX' ? 'riel' : 'USD';
  }
  get currencySymbol(): string {
    return currencySymbol(this.currency);
  }
  /** Quantity unit — gold trades in chi, everything else in shares. */
  get qtyUnit(): string {
    return this.market === 'GOLD_KH' ? 'chi' : 'shares';
  }

  // Confirmation screen models
  readonly showConfirm = signal(false);
  readonly loadingValidation = signal(false);
  readonly simulatedPnl = signal(0);
  readonly simulatedLossAmount = signal(0);
  readonly isLoss = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly existingQty = signal(0);

  // Feedback signals
  readonly tradeSuccess = signal<TradeResult | null>(null);
  readonly tradeError = signal<string | null>(null);

  // Position details for selected stock
  readonly activePosition = signal<Position | null>(null);
  readonly loadingPosition = signal<boolean>(false);

  // Computed average buy cost from the remaining lots
  readonly averageCost = computed(() => {
    const pos = this.activePosition();
    if (!pos || !pos.remainingLots || pos.remainingLots.length === 0) return 0;

    let totalCost = 0;
    let totalQty = 0;
    for (const lot of pos.remainingLots) {
      totalCost += lot.qtyOpen * lot.price;
      totalQty += lot.qtyOpen;
    }
    return totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
  });

  /** Live market context for the selected symbol (price + day change when known). */
  get quoteInfo(): { price: number; change: number | null } | null {
    if (this.market === 'CSX') {
      const t = this.tickersList().find((x) => x.ticker === this.tradeTicker);
      return t ? { price: t.price, change: t.change } : null;
    }
    const q = this.latestQuote();
    return q && q.ticker === this.tradeTicker ? { price: q.price, change: q.change } : null;
  }

  /**
   * Client-side preview of how a SELL would consume the open lots — cheapest
   * first, mirroring the backend's best-price matcher. Gross of commissions;
   * the server's simulation at the review step stays the source of truth.
   */
  get sellLotPreview(): {
    rows: { seq: number; price: number; qtyOpen: number; use: number; pnl: number }[];
    grossPnl: number;
    shortfall: number;
  } | null {
    const pos = this.activePosition();
    const qty = Number(this.tradeQty);
    const price = Number(this.tradePrice);
    if (this.tradeSide !== 'SELL' || !pos || qty <= 0 || price <= 0) return null;
    const lots = pos.remainingLots.filter((l) => l.qtyOpen > 0).sort((a, b) => a.price - b.price);
    if (lots.length === 0) return null;

    const rows: { seq: number; price: number; qtyOpen: number; use: number; pnl: number }[] = [];
    let remaining = qty;
    let grossPnl = 0;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const use = Math.min(lot.qtyOpen, remaining);
      const pnl = (price - lot.price) * use;
      rows.push({ seq: lot.seq, price: lot.price, qtyOpen: lot.qtyOpen, use, pnl });
      grossPnl += pnl;
      remaining -= use;
    }
    return { rows, grossPnl, shortfall: remaining };
  }

  /** SELL helper: set the quantity to a percentage of the open position. */
  setQtyPercent(pct: number) {
    const available = this.activePosition()?.remainingQty ?? 0;
    if (available <= 0) return;
    this.tradeQty = Math.max(1, Math.floor((available * pct) / 100));
    this.onPriceQtyChange();
  }

  ngOnInit() {
    this.loadTickers();
  }

  loadTickers() {
    this.loadingTickers.set(true);
    this.api.getPrices().subscribe({
      next: (data) => {
        this.tickersList.set(data);
        this.loadingTickers.set(false);
        if (data && data.length > 0) {
          this.tradeTicker = data[0].ticker;
          this.tradePrice = data[0].price;
          this.onPriceQtyChange();
          this.loadPositionDetails(this.tradeTicker);
        }
      },
      error: () => this.loadingTickers.set(false)
    });
  }

  loadPositionDetails(ticker: string) {
    if (!ticker) {
      this.activePosition.set(null);
      return;
    }
    this.loadingPosition.set(true);
    this.api.getPosition(ticker, this.market).subscribe({
      next: (pos) => {
        this.activePosition.set(pos);
        this.loadingPosition.set(false);
      },
      error: (err) => {
        console.error('Error fetching position details:', err);
        // Fallback for symbols without existing trades/positions
        this.activePosition.set({
          ticker: ticker,
          totalBoughtQty: 0,
          totalSoldQty: 0,
          remainingQty: 0,
          soldPercent: 0,
          realisedPnl: 0,
          buys: [],
          sells: [],
          remainingLots: []
        });
        this.loadingPosition.set(false);
      }
    });
  }

  onTickerChange() {
    const selected = this.tickersList().find((t) => t.ticker === this.tradeTicker);
    if (selected) {
      this.tradePrice = selected.price;
    }
    this.onPriceQtyChange();
    this.loadPositionDetails(this.tradeTicker);
  }

  /** Switch market: reset the symbol/price to that market's default input mode. */
  onMarketChange() {
    this.tradeTicker = '';
    this.tradePrice = 0;
    this.tradeQty = 0;
    this.tradeCommission = 0;
    this.isCommissionManual = false;
    this.usResults.set([]);
    this.latestQuote.set(null);
    this.activePosition.set(null);

    if (this.market === 'CSX') {
      const list = this.tickersList();
      if (list.length > 0) {
        this.tradeTicker = list[0].ticker;
        this.tradePrice = list[0].price;
        this.loadPositionDetails(this.tradeTicker);
      }
    } else if (this.market === 'GOLD_KH') {
      this.tradeTicker = this.GOLD_SYMBOL;
      this.fetchQuote(this.GOLD_SYMBOL);
      this.loadPositionDetails(this.GOLD_SYMBOL);
    }
    // US: wait for the user to search & pick a symbol.
    this.onPriceQtyChange();
  }

  /** US symbol search (Finnhub). */
  searchSymbols(query: string) {
    const q = (query || '').trim();
    if (q.length < 1) {
      this.usResults.set([]);
      return;
    }
    this.searchingSymbols.set(true);
    this.api.searchSymbols(q).subscribe({
      next: (res) => {
        this.usResults.set(res.results || []);
        this.searchingSymbols.set(false);
      },
      error: () => this.searchingSymbols.set(false)
    });
  }

  pickSymbol(symbol: string) {
    this.tradeTicker = symbol.toUpperCase();
    this.usResults.set([]);
    this.fetchQuote(this.tradeTicker);
    this.loadPositionDetails(this.tradeTicker);
  }

  /** Pull a live quote to prefill the price (US via Finnhub, gold via the board). */
  private fetchQuote(symbol: string) {
    this.quoteLoading.set(true);
    this.api.getMarketQuote(symbol, this.market).subscribe({
      next: (q) => {
        this.tradePrice = q.price;
        this.latestQuote.set(q);
        this.onPriceQtyChange();
        this.quoteLoading.set(false);
      },
      error: () => this.quoteLoading.set(false) // no live price — user types it in
    });
  }

  onPriceQtyChange() {
    if (!this.isCommissionManual) {
      const raw = Number(this.tradePrice) * Number(this.tradeQty) * 0.0047;
      // KHR is whole; USD keeps cents.
      this.tradeCommission = this.currency === 'USD' ? Math.round(raw * 100) / 100 : Math.round(raw);
    }
  }

  onCommissionInput() {
    this.isCommissionManual = true;
  }

  get totalTradeAmount(): number {
    const subtotal = Number(this.tradePrice) * Number(this.tradeQty);
    const commission = Number(this.tradeCommission) || 0;
    return this.tradeSide === 'BUY' ? (subtotal + commission) : (subtotal - commission);
  }

  private buildTradePayload(): TradePayload {
    return {
      ticker: this.tradeTicker.toUpperCase(),
      side: this.tradeSide,
      price: Number(this.tradePrice),
      qty: Number(this.tradeQty),
      commission: Number(this.tradeCommission),
      market: this.market,
      currency: this.currency,
      ...(this.tradeDate && this.tradeDate !== this.today ? { orderDate: this.tradeDate } : {})
    };
  }

  startTradeSubmit(event: Event) {
    event.preventDefault();
    this.tradeSuccess.set(null);
    this.tradeError.set(null);
    this.validationError.set(null);
    this.isLoss.set(false);
    this.simulatedPnl.set(0);
    this.simulatedLossAmount.set(0);

    if (!this.tradeTicker || this.tradePrice <= 0 || this.tradeQty <= 0) {
      this.tradeError.set('Please fill out all fields with valid numbers');
      return;
    }

    this.loadingValidation.set(true);
    this.api.initTrade(this.buildTradePayload()).subscribe({
      next: (res) => {
        this.loadingValidation.set(false);
        this.existingQty.set(res.existingQty);
        this.validationError.set(res.validationError);
        this.simulatedPnl.set(res.simulatedPnl);
        this.isLoss.set(res.isLoss);
        this.simulatedLossAmount.set(res.simulatedLossAmount);
        this.showConfirm.set(true);
      },
      error: (err) => {
        this.loadingValidation.set(false);
        const errMsg = err.error?.detail || err.error?.error || 'Failed to validate trade';
        this.tradeError.set(errMsg);
      }
    });
  }

  confirmAndSubmitTrade() {
    this.showConfirm.set(false);
    this.api.confirmTrade(this.buildTradePayload()).subscribe({
      next: (res) => {
        this.tradeSuccess.set(res);
        this.tradeQty = 0;
        this.tradeCommission = 0;
        this.isCommissionManual = false;
        this.tradeDate = this.today;
        this.loadPositionDetails(this.tradeTicker);
      },
      error: (err) => {
        const errMsg = err.error?.detail || err.error?.error || 'Failed to submit trade';
        this.tradeError.set(errMsg);
      }
    });
  }

  cancelConfirm() {
    this.showConfirm.set(false);
    this.validationError.set(null);
  }
}
