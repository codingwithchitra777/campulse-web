import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { MoneyPipe } from '../../utils/money';
import { Analytics } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

/** Descriptive portfolio analytics (win rate, hold time, per-currency P/L). */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, MoneyPipe, TranslatePipe],
  templateUrl: './analytics.html'
})
export class AnalyticsComponent {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  readonly analytics = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAnalytics(),
    defaultValue: {
      tradeCount: 0, buyCount: 0, sellCount: 0, closedTradeCount: 0,
      wins: 0, losses: 0, winRate: 0, avgHoldDays: 0,
      bestTrade: null, worstTrade: null, byCurrency: [], byMarket: [], byTag: []
    } as Analytics
  });
}
