import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { PagerComponent } from '../../../components/pager/pager';
import { Paginated, Trade } from '../../../models';

@Component({
  selector: 'app-admin-trades',
  standalone: true,
  imports: [CommonModule, PagerComponent, TranslatePipe],
  templateUrl: './admin-trades.html'
})
export class AdminTradesComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly tradesOffset = signal(0);
  readonly tradesLimit = signal(50);

  readonly trades = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.tradesOffset(), limit: this.tradesLimit() }),
    stream: ({ params }) => this.api.getAllTrades(params.limit, params.offset),
    defaultValue: { items: [], total: 0, limit: 50, offset: 0 } as Paginated<Trade>
  });

  setTradesLimit(limit: number) {
    this.tradesLimit.set(limit);
    this.tradesOffset.set(0);
  }

  constructor() {
    effect(() => {
      this.session.activeUserId();
      this.tradesOffset.set(0);
    });
  }
}
