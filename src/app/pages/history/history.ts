import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { Paginated, Trade } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, PagerComponent, TranslatePipe],
  templateUrl: './history.html'
})
export class HistoryComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);

  readonly offset = signal(0);

  readonly trades = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.offset() }),
    stream: ({ params }) => this.api.getTrades(undefined, PAGE_SIZE, params.offset),
    defaultValue: { items: [], total: 0, limit: PAGE_SIZE, offset: 0 } as Paginated<Trade>
  });

  constructor() {
    // Switching users mid-browse could otherwise leave the page on an offset
    // that's out of range for the new user's trade count.
    effect(() => {
      this.session.activeUserId();
      this.offset.set(0);
    });
  }
}
