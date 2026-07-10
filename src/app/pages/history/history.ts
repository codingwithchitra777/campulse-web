import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { Paginated, Trade } from '../../models';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, TranslatePipe],
  templateUrl: './history.html'
})
export class HistoryComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly translate = inject(TranslateService);

  readonly offset = signal(0);

  readonly trades = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.offset() }),
    stream: ({ params }) => this.api.getTrades(undefined, PAGE_SIZE, params.offset),
    defaultValue: { items: [], total: 0, limit: PAGE_SIZE, offset: 0 } as Paginated<Trade>
  });

  // Slide-in drawer, same pattern as PortfolioComponent.selectedHolding.
  readonly editingTrade = signal<Trade | null>(null);
  editTicker = '';
  editPrice = 0;
  editQty = 0;
  editCommission = 0;
  editDate = '';
  readonly today = new Date().toISOString().split('T')[0];

  constructor() {
    // Switching users mid-browse could otherwise leave the page on an offset
    // that's out of range for the new user's trade count.
    effect(() => {
      this.session.activeUserId();
      this.offset.set(0);
    });
  }

  startEdit(t: Trade) {
    this.editTicker = t.ticker;
    this.editPrice = t.price;
    this.editQty = t.qty;
    this.editCommission = t.commission;
    this.editDate = t.orderDate.slice(0, 10);
    this.editingTrade.set(t);
  }

  closeDrawer() {
    this.editingTrade.set(null);
  }

  saveEdit() {
    const tradeId = this.editingTrade()?.tradeId;
    if (!tradeId) return;
    this.api
      .updateTrade(tradeId, {
        ticker: this.editTicker,
        price: this.editPrice,
        qty: this.editQty,
        commission: this.editCommission,
        ...(this.editDate ? { orderDate: this.editDate } : {})
      })
      .subscribe({
        next: () => {
          this.editingTrade.set(null);
          this.trades.reload();
        },
        error: (err) => alert('Failed to update trade: ' + (err.error?.detail || 'Unknown error'))
      });
  }

  deleteTrade(t: Trade) {
    if (!confirm(this.translate.instant('HISTORY.CONFIRM_DELETE'))) return;
    this.api.deleteTrade(t.tradeId).subscribe({
      next: () => this.trades.reload(),
      error: (err) => alert('Failed to delete trade: ' + (err.error?.detail || 'Unknown error'))
    });
  }
}
