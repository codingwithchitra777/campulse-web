import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { MoneyPipe } from '../../utils/money';
import { AdminStats, AdminUser, ManualPrice, Paginated, Trade } from '../../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, MoneyPipe, TranslatePipe],
  templateUrl: './admin.html'
})
export class AdminComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly usersOffset = signal(0);
  readonly tradesOffset = signal(0);
  readonly usersLimit = signal(50);
  readonly tradesLimit = signal(50);

  readonly users = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.usersOffset(), limit: this.usersLimit() }),
    stream: ({ params }) => this.api.getAllUsers(params.limit, params.offset),
    defaultValue: { items: [], total: 0, limit: 50, offset: 0 } as Paginated<AdminUser>
  });

  readonly trades = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.tradesOffset(), limit: this.tradesLimit() }),
    stream: ({ params }) => this.api.getAllTrades(params.limit, params.offset),
    defaultValue: { items: [], total: 0, limit: 50, offset: 0 } as Paginated<Trade>
  });

  setUsersLimit(limit: number) {
    this.usersLimit.set(limit);
    this.usersOffset.set(0);
  }

  setTradesLimit(limit: number) {
    this.tradesLimit.set(limit);
    this.tradesOffset.set(0);
  }

  readonly stats = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAdminStats(),
    defaultValue: { totalUsers: 0, totalTrades: 0, totalRealisedPnl: 0 } as AdminStats
  });

  // Local gold board (admin-set price for XAU-KH).
  readonly manualPrices = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getManualPrices(),
    defaultValue: { items: [] as ManualPrice[] }
  });
  goldPrice: number | null = null;
  readonly goldSaving = signal(false);
  readonly goldMsg = signal<string | null>(null);

  saveGoldPrice() {
    if (!this.goldPrice || this.goldPrice <= 0) {
      this.goldMsg.set('Enter a positive price');
      return;
    }
    this.goldSaving.set(true);
    this.goldMsg.set(null);
    this.api.setManualPrice({ price: this.goldPrice, market: 'GOLD_KH', symbol: 'XAU-KH', currency: 'USD' }).subscribe({
      next: () => {
        this.goldSaving.set(false);
        this.goldMsg.set('Saved ✓');
        this.manualPrices.reload();
      },
      error: (err) => {
        this.goldSaving.set(false);
        this.goldMsg.set(err.error?.detail || 'Failed to save');
      }
    });
  }

  constructor() {
    effect(() => {
      this.session.activeUserId();
      this.usersOffset.set(0);
      this.tradesOffset.set(0);
    });
  }

  toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    this.api.updateUserRole(user.userId, newRole).subscribe({
      next: () => this.users.reload(),
      error: (err) => alert('Failed to update role: ' + (err.error?.detail || 'Unknown error'))
    });
  }
}
