import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { PagerComponent } from '../../../components/pager/pager';
import { AdminUser, Paginated } from '../../../models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, PagerComponent, TranslatePipe],
  templateUrl: './admin-users.html'
})
export class AdminUsersComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly usersOffset = signal(0);
  readonly usersLimit = signal(50);

  readonly users = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.usersOffset(), limit: this.usersLimit() }),
    stream: ({ params }) => this.api.getAllUsers(params.limit, params.offset),
    defaultValue: { items: [], total: 0, limit: 50, offset: 0 } as Paginated<AdminUser>
  });

  setUsersLimit(limit: number) {
    this.usersLimit.set(limit);
    this.usersOffset.set(0);
  }

  constructor() {
    effect(() => {
      this.session.activeUserId();
      this.usersOffset.set(0);
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
