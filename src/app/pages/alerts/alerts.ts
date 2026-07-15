import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { MoneyPipe } from '../../utils/money';
import { CurrencyCode, MarketKind, PriceAlert } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';

/** Price alerts delivered to the user's linked Telegram when a symbol crosses a target. */
@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MoneyPipe, TranslatePipe],
  templateUrl: './alerts.html'
})
export class AlertsComponent {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);
  readonly GOLD_SYMBOL = 'XAU-KH';

  readonly alerts = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getAlerts(),
    defaultValue: { items: [] as PriceAlert[], deliverable: true }
  });

  readonly activeAlerts = computed(() => this.alerts.value().items.filter(a => a.active));
  readonly triggeredAlerts = computed(() => this.alerts.value().items.filter(a => !a.active));

  market: MarketKind = 'CSX';
  symbolInput = '';
  targetPrice: number | null = null;
  readonly adding = signal(false);
  readonly error = signal<string | null>(null);

  get currency(): CurrencyCode {
    return this.market === 'CSX' ? 'KHR' : 'USD';
  }

  onMarketChange() {
    this.symbolInput = this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : '';
  }

  add() {
    const symbol = (this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : this.symbolInput).trim().toUpperCase();
    if (!symbol || !this.targetPrice || this.targetPrice <= 0) {
      this.error.set('Enter a symbol and a positive target price');
      return;
    }
    this.adding.set(true);
    this.error.set(null);
    this.api.createAlert({ symbol, targetPrice: this.targetPrice, market: this.market, currency: this.currency }).subscribe({
      next: () => {
        this.adding.set(false);
        this.symbolInput = this.market === 'GOLD_KH' ? this.GOLD_SYMBOL : '';
        this.targetPrice = null;
        this.alerts.reload();
      },
      error: (err) => {
        this.adding.set(false);
        this.error.set(err.error?.detail || 'Failed to create alert');
      }
    });
  }

  remove(a: PriceAlert) {
    this.api.removeAlert(a.alertId).subscribe({
      next: () => this.alerts.reload(),
      error: (err) => this.error.set(err.error?.detail || 'Failed to remove')
    });
  }
}
