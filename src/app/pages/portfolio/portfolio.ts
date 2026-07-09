import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, HoldingView, PositionSell } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './portfolio.html'
})
export class PortfolioComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly portfolio = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getPortfolio().pipe(map((holdings) => holdings.map(toHoldingView))),
    defaultValue: [] as HoldingView[]
  });

  readonly selectedHolding = signal<HoldingView | null>(null);

  // Loads whenever a holding is selected; idle while nothing is selected.
  // Switching selection cancels the in-flight request automatically.
  readonly holdingDetails = rxResource({
    params: () => this.selectedHolding()?.ticker,
    stream: ({ params: ticker }) => this.api.getPosition(ticker)
  });

  selectHolding(holding: HoldingView) {
    this.selectedHolding.set(holding);
  }

  /**
   * Unrealised P/L of a single buy lot: what the still-open quantity gains or
   * loses at the current market price vs its buy price. Null when the lot is
   * fully sold or no market price is available.
   */
  lotPnl(lot: { qtyOpen: number; price: number }): number | null {
    const lastPrice = this.selectedHolding()?.lastPrice ?? null;
    if (lastPrice === null || lot.qtyOpen <= 0) return null;
    return lot.qtyOpen * (lastPrice - lot.price);
  }

  /** Price move of an open buy lot vs the current market price, in percent. */
  lotPnlPercent(lot: { qtyOpen: number; price: number }): number | null {
    const lastPrice = this.selectedHolding()?.lastPrice ?? null;
    if (lastPrice === null || lot.qtyOpen <= 0 || lot.price <= 0) return null;
    return ((lastPrice - lot.price) / lot.price) * 100;
  }

  /** Realised P/L of a sell over the cost basis of its LIFO-matched buy lots, in percent. */
  sellPnlPercent(sell: PositionSell): number | null {
    const costBasis = sell.matched.reduce((sum, m) => sum + m.qty * m.price, 0);
    if (costBasis <= 0) return null;
    return (sell.pnl / costBasis) * 100;
  }
}

/**
 * Guarantee a numeric totalPnlPercent: prefer the backend-provided value,
 * falling back to a client-side derivation over the remaining cost basis.
 */
function toHoldingView(h: Holding): HoldingView {
  if (typeof h.totalPnlPercent === 'number') {
    return { ...h, totalPnlPercent: h.totalPnlPercent };
  }
  const costBasis = (h.avgCostRemaining ?? 0) * h.remainingQty;
  return {
    ...h,
    totalPnlPercent: costBasis > 0 ? (h.totalPnl / costBasis) * 100 : 0
  };
}

