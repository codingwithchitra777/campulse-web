import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { ExchangeRate } from '../../../models';

@Component({
  selector: 'app-admin-exchange-rates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-exchange-rates.html'
})
export class AdminExchangeRatesComponent {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);

  readonly rates = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getExchangeRatesHistory('USD', 'KHR', 50),
    defaultValue: { items: [] as ExchangeRate[] }
  });

  rateForm = { baseCurrency: 'USD', targetCurrency: 'KHR', bidRate: null as number | null, askRate: null as number | null, effectiveDate: '' };
  readonly rateSaving = signal(false);
  readonly rateMsg = signal<string | null>(null);

  saveRate() {
    if (!this.rateForm.effectiveDate) { this.rateMsg.set('Pick an effective date'); return; }
    if (!this.rateForm.bidRate || this.rateForm.bidRate <= 0) { this.rateMsg.set('Bid Rate must be positive'); return; }
    if (!this.rateForm.askRate || this.rateForm.askRate <= 0) { this.rateMsg.set('Ask Rate must be positive'); return; }
    
    this.rateSaving.set(true);
    this.rateMsg.set(null);
    this.api.addExchangeRate({
      baseCurrency: this.rateForm.baseCurrency,
      targetCurrency: this.rateForm.targetCurrency,
      bidRate: this.rateForm.bidRate,
      askRate: this.rateForm.askRate,
      effectiveDate: this.rateForm.effectiveDate
    }).subscribe({
      next: () => {
        this.rateSaving.set(false);
        this.rateMsg.set('Rate saved ✓');
        this.rateForm.bidRate = null;
        this.rateForm.askRate = null;
        this.rates.reload();
      },
      error: (err) => {
        this.rateSaving.set(false);
        this.rateMsg.set(err.error?.detail || 'Failed to save rate');
      }
    });
  }
}
