import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { MoneyPipe } from '../../utils/money';
import { AdminStats, AdminUser, CorporateAction, ManualPrice, Paginated, Trade } from '../../models';

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

  // Corporate actions (bonus/split). The daemon applies each on its ex-date;
  // this card only registers/lists them.
  readonly corpActions = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getCorporateActions(),
    defaultValue: { items: [] as CorporateAction[] }
  });
  ca = { symbol: '', actionType: 'bonus' as 'bonus' | 'split', ratioNew: 1, ratioHeld: 1, exDate: '', market: 'CSX', note: '' };
  readonly caSaving = signal(false);
  readonly caMsg = signal<string | null>(null);

  saveCorporateAction() {
    if (!this.ca.symbol.trim()) { this.caMsg.set('Enter a symbol'); return; }
    if (!this.ca.exDate) { this.caMsg.set('Pick an ex-date'); return; }
    if (this.ca.ratioNew <= 0 || this.ca.ratioHeld <= 0) { this.caMsg.set('Ratios must be positive'); return; }
    this.caSaving.set(true);
    this.caMsg.set(null);
    this.api.createCorporateAction({
      symbol: this.ca.symbol.trim().toUpperCase(),
      actionType: this.ca.actionType,
      ratioNew: this.ca.ratioNew,
      ratioHeld: this.ca.ratioHeld,
      exDate: this.ca.exDate,
      market: this.ca.market,
      note: this.ca.note.trim() || undefined
    }).subscribe({
      next: () => {
        this.caSaving.set(false);
        this.caMsg.set('Registered ✓');
        this.ca.symbol = '';
        this.ca.note = '';
        this.corpActions.reload();
      },
      error: (err) => {
        this.caSaving.set(false);
        this.caMsg.set(err.error?.detail || 'Failed to register');
      }
    });
  }

  deleteCorporateAction(a: CorporateAction) {
    if (a.appliedAt) return; // applied ones are immutable
    if (!confirm(`Delete the ${a.ratioNew}:${a.ratioHeld} ${a.actionType} on ${a.symbol}?`)) return;
    this.api.deleteCorporateAction(a.actionId).subscribe({
      next: () => this.corpActions.reload(),
      error: (err) => alert('Failed to delete: ' + (err.error?.detail || 'Unknown error'))
    });
  }

  // Market events (holidays, dividends) for the calendar.
  readonly marketEvents = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getMarketEvents(),
    defaultValue: { success: true, items: [] }
  });
  me = { market: 'CSX', eventType: 'holiday' as 'holiday' | 'dividend', eventDate: '', symbol: '', description: '' };
  readonly meSaving = signal(false);
  readonly meMsg = signal<string | null>(null);

  saveMarketEvent() {
    if (!this.me.eventDate) { this.meMsg.set('Pick an event date'); return; }
    if (this.me.eventType === 'dividend' && !this.me.symbol.trim()) { this.meMsg.set('Dividends require a symbol'); return; }
    this.meSaving.set(true);
    this.meMsg.set(null);
    this.api.createMarketEvent({
      market: this.me.market,
      eventType: this.me.eventType,
      eventDate: this.me.eventDate,
      symbol: this.me.symbol.trim().toUpperCase() || undefined,
      description: this.me.description.trim() || undefined
    }).subscribe({
      next: () => {
        this.meSaving.set(false);
        this.meMsg.set('Registered ✓');
        this.me.symbol = '';
        this.me.description = '';
        this.marketEvents.reload();
      },
      error: (err) => {
        this.meSaving.set(false);
        this.meMsg.set(err.error?.detail || 'Failed to register event');
      }
    });
  }

  deleteMarketEvent(eventId: string) {
    if (!confirm('Delete this market event?')) return;
    this.api.deleteMarketEvent(eventId).subscribe({
      next: () => this.marketEvents.reload(),
      error: (err) => alert('Failed to delete: ' + (err.error?.detail || 'Unknown error'))
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
