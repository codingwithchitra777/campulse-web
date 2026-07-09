import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Position, Price, TradePayload, TradeResult, TradeSide } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-record-trade',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './record-trade.html'
})
export class RecordTradeComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly tickersList = signal<Price[]>([]);
  readonly loadingTickers = signal<boolean>(false);

  tradeTicker = '';
  tradeSide: TradeSide = 'BUY';
  tradePrice = 0;
  tradeQty = 0;
  tradeCommission = 0;
  isCommissionManual = false;

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
    this.api.getPosition(ticker).subscribe({
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

  onPriceQtyChange() {
    if (!this.isCommissionManual) {
      this.tradeCommission = Math.round(Number(this.tradePrice) * Number(this.tradeQty) * 0.0047);
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
      commission: Number(this.tradeCommission)
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
