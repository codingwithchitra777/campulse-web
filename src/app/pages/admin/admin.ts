import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { AdminStats, AdminUser, Paginated, Trade } from '../../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, PagerComponent],
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
