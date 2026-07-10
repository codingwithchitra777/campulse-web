import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, Price, TopOrder, TopTicker } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './dashboard.html'
})
export class DashboardComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  // Personal data is keyed on the active user: it refetches automatically on
  // login/logout/user switch, and idles (empty) while browsing as guest.
  private readonly userId = computed(() =>
    this.session.isGuest() ? undefined : this.session.activeUserId()
  );

  readonly prices = rxResource({
    stream: () => this.api.getPrices(),
    defaultValue: [] as Price[]
  });

  readonly portfolio = rxResource({
    params: () => this.userId(),
    stream: () => this.api.getPortfolio(),
    defaultValue: [] as Holding[]
  });

  readonly topTickers = rxResource({
    params: () => this.userId(),
    stream: () => this.api.getTopTickers(),
    defaultValue: [] as TopTicker[]
  });

  readonly topOrders = rxResource({
    params: () => this.userId(),
    stream: () => this.api.getTopOrders(),
    defaultValue: [] as TopOrder[]
  });

  /** Magnitude of the day's move; the ▲/▼ arrow carries the sign. */
  changeAbs(p: Price): number | null {
    return p.change === null ? null : Math.abs(p.change);
  }

  /** Day's move as % of the previous close (price before the change). */
  changePercent(p: Price): number | null {
    const change = this.changeAbs(p);
    if (change === null || change === 0 || p.change_direction === 'equal') return null;
    const prevClose = p.change_direction === 'up' ? p.price - change : p.price + change;
    return prevClose > 0 ? (change / prevClose) * 100 : null;
  }

  readonly totalRealisedPnl = computed(() =>
    this.portfolio.value().reduce((sum, h) => sum + (h.realisedPnl || 0), 0)
  );

  readonly totalUnrealisedPnl = computed(() =>
    this.portfolio.value().reduce((sum, h) => sum + (h.unrealisedPnl || 0), 0)
  );

  readonly totalPnl = computed(() => this.totalRealisedPnl() + this.totalUnrealisedPnl());
}
