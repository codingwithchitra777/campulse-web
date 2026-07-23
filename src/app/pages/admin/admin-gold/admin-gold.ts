import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { GoldPrice } from '../../../models';

@Component({
  selector: 'app-admin-gold',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-gold.html',
})
export class AdminGoldComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly history = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getGoldHistory(),
    defaultValue: { items: [] as GoldPrice[] },
  });

  readonly drawerOpen = signal(false);
  form = { bidPrice: null as number | null, askPrice: null as number | null, effectiveDate: '' };
  readonly saving = signal(false);
  readonly msg = signal<string | null>(null);

  openDrawer() {
    this.form = { bidPrice: null, askPrice: null, effectiveDate: new Date().toISOString().slice(0, 10) };
    this.msg.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
  }

  save() {
    if (!this.form.effectiveDate) {
      this.msg.set('Pick an effective date');
      return;
    }
    if (!this.form.bidPrice || this.form.bidPrice <= 0) {
      this.msg.set('Bid must be positive');
      return;
    }
    if (!this.form.askPrice || this.form.askPrice <= 0) {
      this.msg.set('Ask must be positive');
      return;
    }
    this.saving.set(true);
    this.msg.set(null);
    this.api
      .addGoldPrice({
        bidPrice: this.form.bidPrice,
        askPrice: this.form.askPrice,
        effectiveDate: this.form.effectiveDate,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.history.reload();
          this.drawerOpen.set(false);
        },
        error: (err) => {
          this.saving.set(false);
          this.msg.set(err.error?.detail || 'Failed to save');
        },
      });
  }
}
