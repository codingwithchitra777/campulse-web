import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';

@Component({
  selector: 'app-admin-market-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-market-events.html'
})
export class AdminMarketEventsComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

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
}
