import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { Holding, Price, TopOrder, TopTicker, YearlyPnl } from '../../models';
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

  readonly yearlyPnl = rxResource({
    params: () => this.userId(),
    stream: () => this.api.getYearlyPnl(),
    defaultValue: [] as YearlyPnl[]
  });

  readonly expandedYear = signal<number | null>(null);

  toggleYear(year: number) {
    this.expandedYear.set(this.expandedYear() === year ? null : year);
  }

  readonly totalRealisedPnl = computed(() =>
    this.portfolio.value().reduce((sum, h) => sum + (h.realisedPnl || 0), 0)
  );

  readonly totalUnrealisedPnl = computed(() =>
    this.portfolio.value().reduce((sum, h) => sum + (h.unrealisedPnl || 0), 0)
  );

  readonly totalPnl = computed(() => this.totalRealisedPnl() + this.totalUnrealisedPnl());
}
