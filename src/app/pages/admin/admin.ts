import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { AdminStats, AdminUser, Trade } from '../../models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html'
})
export class AdminComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly users = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAllUsers(),
    defaultValue: [] as AdminUser[]
  });

  readonly trades = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAllTrades(),
    defaultValue: [] as Trade[]
  });

  readonly stats = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAdminStats(),
    defaultValue: { totalUsers: 0, totalTrades: 0, totalRealisedPnl: 0 } as AdminStats
  });

  toggleRole(user: AdminUser) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    this.api.updateUserRole(user.userId, newRole).subscribe({
      next: () => this.users.reload(),
      error: (err) => alert('Failed to update role: ' + (err.error?.detail || 'Unknown error'))
    });
  }
}
