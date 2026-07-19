import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { CorporateAction } from '../../../models';

@Component({
  selector: 'app-admin-corp-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-corp-actions.html'
})
export class AdminCorpActionsComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

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
}
