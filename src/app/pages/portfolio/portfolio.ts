import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, HoldingView } from '../../models';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule],
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
}

/**
 * The backend doesn't send totalPnlPercent (the template used to render an
 * empty cell) — derive it from the P/L over the remaining cost basis.
 */
function toHoldingView(h: Holding): HoldingView {
  const costBasis = (h.avgCostRemaining ?? 0) * h.remainingQty;
  return {
    ...h,
    totalPnlPercent: costBasis > 0 ? (h.totalPnl / costBasis) * 100 : 0
  };
}
