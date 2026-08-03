import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { GridService } from '../../services/grid.service';
import { SessionService } from '../../services/session.service';
import {
  CurrencyCode,
  GridPlan,
  GridRung,
  GridSpacing,
  MarketKind,
  MarketQuote,
  MarketSearchResult,
  Price,
  TradePayload,
  TradeSide
} from '../../models';
import { MoneyPipe, currencySymbol } from '../../utils/money';
import { TranslatePipe } from '@ngx-translate/core';

type GridMode = 'plan' | 'active';

/**
 * Grid trading — a two-mode recording flow (Campulse records, it does not
 * execute). PLAN mode designs a ladder of resting orders and registers it;
 * ACTIVE mode lets the user tap each armed rung to record the fill when their
 * broker executes it (one confirmTrade per fill). State is held in
 * GridService (persisted per user); this component stays imperative, like
 * record-trade, because of the market-picker form flow.
 */
@Component({
  selector: 'app-grid-trade',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './grid-trade.html'
})
export class GridTradeComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly grid = inject(GridService);
  private readonly session = inject(SessionService);

  readonly mode = signal<GridMode>('plan');

  // ---- market / symbol picker (mirrors record-trade) ----
  market: MarketKind = 'US';
  readonly tickersList = signal<Price[]>([]);
  readonly loadingTickers = signal(false);
  readonly usResults = signal<MarketSearchResult[]>([]);
  readonly searchingSymbols = signal(false);
  readonly quoteLoading = signal(false);
  readonly GOLD_SYMBOL = 'XAU-KH';
  readonly latestQuote = signal<MarketQuote | null>(null);

  ticker = '';
  referencePrice = 0;

  // ---- grid setup inputs ----
  lower = 0;
  upper = 0;
  levels = 7;
  qty = 5;
  spacing: GridSpacing = 'arith';

  // ---- feedback ----
  readonly formError = signal<string | null>(null);
  readonly recording = signal(false);
  readonly recordError = signal<string | null>(null);
  readonly toast = signal<string | null>(null);

  // ---- fill confirm dialog (broker fills aren't always exactly at the rung price) ----
  readonly pendingFill = signal<{ rung: GridRung; side: TradeSide; price: number } | null>(null);

  readonly plan = this.grid.plan;

  get currency(): CurrencyCode {
    return this.market === 'CSX' ? 'KHR' : 'USD';
  }
  get currencySymbol(): string {
    return currencySymbol(this.currency);
  }
  get qtyUnit(): string {
    return this.market === 'GOLD_KH' ? 'chi' : 'shares';
  }

  /** Live quote context for the selected symbol. */
  get quoteInfo(): { price: number; change: number | null } | null {
    if (this.market === 'CSX') {
      const t = this.tickersList().find((x) => x.ticker === this.ticker);
      return t ? { price: t.price, change: t.change } : null;
    }
    const q = this.latestQuote();
    return q && q.ticker === this.ticker ? { price: q.price, change: q.change } : null;
  }

  // ---- computed grid preview (plan mode, before registering) ----
  readonly previewLevels = computed(() => {
    void this.previewTick();
    return this.grid.computeLevels(this.lower, this.upper, this.levels, this.spacing)
      .map((p) => this.grid.roundPrice(p, this.currency));
  });

  /** Bumped on every input change to invalidate the computed preview. */
  private readonly previewTick = signal(0);

  readonly previewOrders = computed(() => {
    const prices = this.previewLevels();
    const ref = this.referencePrice;
    const rows: { seq: number; side: TradeSide; price: number; qty: number; value: number }[] = [];
    let seq = 1;
    for (const price of prices) {
      if (Math.abs(price - ref) < 1e-9) continue;
      const side: TradeSide = price < ref ? 'BUY' : 'SELL';
      rows.push({ seq: seq++, side, price, qty: this.qty, value: price * this.qty });
    }
    return rows;
  });

  readonly previewStep = computed(() => {
    const p = this.previewLevels();
    if (p.length < 2) return { abs: 0, pct: 0 };
    const abs = p[1] - p[0];
    return { abs, pct: p[0] > 0 ? (abs / p[0]) * 100 : 0 };
  });

  readonly previewBuyCount = computed(() => this.previewOrders().filter((o) => o.side === 'BUY').length);
  readonly previewSellCount = computed(() => this.previewOrders().filter((o) => o.side === 'SELL').length);
  readonly previewCapital = computed(() =>
    this.previewOrders().filter((o) => o.side === 'BUY').reduce((a, o) => a + o.value, 0)
  );
  readonly previewPerGrid = computed(() => this.previewStep().abs * this.qty);
  readonly previewCycleProfit = computed(() => this.previewPerGrid() * this.previewBuyCount());

  constructor() {
    // Refetch prices + reload the saved plan whenever the user changes.
    effect(() => {
      const userId = this.session.activeUserId();
      this.grid.loadFor(userId);
      if (this.grid.plan()) this.mode.set('active');
    });
  }

  ngOnInit() {
    this.loadTickers();
  }

  private markPreviewDirty() {
    this.previewTick.update((n) => n + 1);
  }

  // ---- ladder rows for the active grid, sorted high → low ----
  readonly activeRungs = computed<GridRung[]>(() => {
    const p = this.plan();
    if (!p) return [];
    return [...p.rungs].sort((a, b) => b.price - a.price);
  });

  loadTickers() {
    this.loadingTickers.set(true);
    this.api.getPrices().subscribe({
      next: (data) => {
        this.tickersList.set(data);
        this.loadingTickers.set(false);
        if (this.market === 'CSX' && data.length > 0 && !this.ticker) {
          this.selectCsxDefault(data);
        }
      },
      error: () => this.loadingTickers.set(false)
    });
  }

  private selectCsxDefault(data: Price[]) {
    this.ticker = data[0].ticker;
    this.referencePrice = data[0].price;
    this.seedRangeFromPrice();
  }

  /** Sensible default range: ±8% around the reference price. */
  private seedRangeFromPrice() {
    const ref = this.referencePrice;
    if (ref <= 0) return;
    this.lower = this.grid.roundPrice(ref * 0.92, this.currency);
    this.upper = this.grid.roundPrice(ref * 1.08, this.currency);
    this.markPreviewDirty();
  }

  onMarketChange() {
    this.ticker = '';
    this.referencePrice = 0;
    this.lower = 0;
    this.upper = 0;
    this.usResults.set([]);
    this.latestQuote.set(null);
    this.formError.set(null);

    if (this.market === 'CSX') {
      const list = this.tickersList();
      if (list.length > 0) this.selectCsxDefault(list);
    } else if (this.market === 'GOLD_KH') {
      this.ticker = this.GOLD_SYMBOL;
      this.fetchQuote(this.GOLD_SYMBOL);
    }
    this.markPreviewDirty();
  }

  onCsxTickerChange() {
    const selected = this.tickersList().find((t) => t.ticker === this.ticker);
    if (selected) {
      this.referencePrice = selected.price;
      this.seedRangeFromPrice();
    }
  }

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
    this.ticker = symbol.toUpperCase();
    this.usResults.set([]);
    this.fetchQuote(this.ticker);
  }

  private fetchQuote(symbol: string) {
    this.quoteLoading.set(true);
    this.api.getMarketQuote(symbol, this.market).subscribe({
      next: (q) => {
        this.referencePrice = q.price;
        this.latestQuote.set(q);
        this.seedRangeFromPrice();
        this.quoteLoading.set(false);
      },
      error: () => this.quoteLoading.set(false)
    });
  }

  onInputChange() {
    this.markPreviewDirty();
  }

  // ---- register the plan → switch to active ----
  registerGrid() {
    this.formError.set(null);
    if (!this.ticker) {
      this.formError.set('Pick an instrument first.');
      return;
    }
    if (this.upper <= this.lower) {
      this.formError.set('Upper bound must be higher than the lower bound.');
      return;
    }
    if (this.referencePrice <= 0) {
      this.formError.set('No reference price for this symbol — enter one or pick another.');
      return;
    }
    if (this.qty < 1) {
      this.formError.set('Quantity per rung must be at least 1.');
      return;
    }
    const plan = this.grid.buildPlan({
      ticker: this.ticker.toUpperCase(),
      market: this.market,
      currency: this.currency,
      lower: this.lower,
      upper: this.upper,
      levels: this.levels,
      qty: this.qty,
      spacing: this.spacing,
      referencePrice: this.referencePrice
    });
    if (plan.rungs.length === 0) {
      this.formError.set('This range produced no orders — widen it or add levels.');
      return;
    }
    this.grid.register(plan);
    this.flash(`Grid registered — ${plan.rungs.length} rungs armed for ${plan.ticker}.`);
    this.mode.set('active');
  }

  // ---- tap a rung → open the confirm dialog (price prefilled, editable) ----
  recordFill(rung: GridRung) {
    if (this.recording()) return;
    this.recordError.set(null);
    this.pendingFill.set({ rung, side: rung.side, price: rung.price });
  }

  cancelFill() {
    this.pendingFill.set(null);
  }

  /** Set the confirm-dialog price to a percentage nudge off the rung price (slippage helper). */
  nudgeFillPrice(delta: number) {
    const pf = this.pendingFill();
    if (!pf) return;
    const next = this.grid.roundPrice(pf.price + delta, this.currencyOf());
    this.pendingFill.set({ ...pf, price: Math.max(0, next) });
  }

  private currencyOf(): CurrencyCode {
    return this.plan()?.currency ?? this.currency;
  }

  // ---- confirm the fill: one recorded trade at the (possibly edited) price ----
  confirmFill() {
    const p = this.plan();
    const pf = this.pendingFill();
    if (!p || !pf || this.recording()) return;
    if (pf.price <= 0) {
      this.recordError.set('Fill price must be greater than zero.');
      return;
    }
    this.recordError.set(null);
    this.recording.set(true);

    const payload: TradePayload = {
      ticker: p.ticker,
      side: pf.side,
      price: pf.price,
      qty: p.qty,
      market: p.market,
      currency: p.currency
    };

    const side = pf.side;
    const price = pf.price;
    this.api.confirmTrade(payload).subscribe({
      next: (res) => {
        // Log the actual filled price; the rung still re-arms on its grid line.
        this.grid.applyFill(pf.rung.id, res.realisedPnl ?? 0, price);
        this.recording.set(false);
        this.pendingFill.set(null);
        const label = side === 'BUY' ? 'Buy' : 'Sell';
        const pnlNote =
          side === 'SELL' ? ` · P/L ${res.realisedPnl >= 0 ? '+' : ''}${res.realisedPnl}` : '';
        this.flash(`${label} recorded @ ${price}${pnlNote}`);
      },
      error: (err) => {
        this.recording.set(false);
        this.recordError.set(err.error?.detail || err.error?.error || 'Failed to record this fill.');
      }
    });
  }

  resetGrid() {
    if (!this.plan()) return;
    const ok = confirm('Re-arm every rung to the original plan? Recorded trades stay in your journal.');
    if (!ok) return;
    this.grid.reset(this.referencePrice || this.plan()!.lower);
    this.flash('Grid re-armed to the original plan.');
  }

  discardGrid() {
    const ok = confirm('Discard this grid plan? Recorded trades stay in your journal; only the plan is cleared.');
    if (!ok) return;
    this.grid.clear();
    this.mode.set('plan');
  }

  goPlan() {
    this.mode.set('plan');
  }
  goActive() {
    if (this.plan()) this.mode.set('active');
  }

  private flash(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(null), 3200);
  }

  // ---- template helpers ----
  subtotal(plan: GridPlan): number {
    return this.grid.buyRungs(plan).reduce((a, r) => a + r.price * plan.qty, 0);
  }
  trackRung = (_: number, r: GridRung) => r.id;
  trackFill = (_: number, f: { id: string }) => f.id;
}
