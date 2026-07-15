import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { PagerComponent } from '../../components/pager/pager';
import { MoneyPipe } from '../../utils/money';
import { Paginated, Trade } from '../../models';

/** Trade journal — annotate each trade with a note + tags (the reflection layer). */
@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [CommonModule, FormsModule, PagerComponent, MoneyPipe],
  templateUrl: './journal.html'
})
export class JournalComponent {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  readonly offset = signal(0);
  readonly limit = signal(20);
  readonly tagFilter = signal('');

  readonly trades = rxResource({
    params: () => ({ userId: this.session.activeUserId(), offset: this.offset(), limit: this.limit() }),
    stream: ({ params }) => this.api.getTrades(undefined, params.limit, params.offset),
    defaultValue: { items: [], total: 0, limit: 20, offset: 0 } as Paginated<Trade>
  });

  /** Client-side tag filter over the current page. */
  readonly visible = computed(() => {
    const f = this.tagFilter().trim().toLowerCase();
    const items = this.trades.value().items;
    if (!f) return items;
    return items.filter(t => (t.tags || '').toLowerCase().includes(f));
  });

  // Inline editing.
  readonly editingId = signal<string | null>(null);
  noteDraft = '';
  tagsDraft = '';
  readonly saving = signal(false);

  startEdit(t: Trade) {
    this.editingId.set(t.tradeId);
    this.noteDraft = t.note || '';
    this.tagsDraft = t.tags || '';
  }

  cancel() {
    this.editingId.set(null);
  }

  save(t: Trade) {
    this.saving.set(true);
    this.api.updateJournal(t.tradeId, { note: this.noteDraft, tags: this.tagsDraft }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.trades.reload();
      },
      error: () => this.saving.set(false)
    });
  }

  tagList(tags: string | null | undefined): string[] {
    return (tags || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  setOffset(o: number) {
    this.offset.set(o);
  }
}
