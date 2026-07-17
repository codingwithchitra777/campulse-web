import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CurrencyCode } from '../../models';
import { MoneyPipe, formatMoney } from '../../utils/money';
import { LoanMethod, LoanSchedule, MAX_TERM_MONTHS, RatePeriod, buildSchedule } from '../../utils/loan';

/**
 * Loan calculator (Tools). Fully client-side — no backend, works for guests.
 * Supports both quoting styles used in Cambodia: flat rate (interest on the
 * original principal, the common MFI quote) and declining balance (EMI).
 */
@Component({
  selector: 'app-loan-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './loan-calculator.html'
})
export class LoanCalculatorComponent {
  readonly MAX_TERM = MAX_TERM_MONTHS;
  readonly termChips = [12, 24, 36, 60];
  readonly today = new Date().toISOString().split('T')[0];

  amount = 10000;
  currency: CurrencyCode = 'USD';
  ratePct = 1.5;
  ratePeriod: RatePeriod = 'MONTH';
  termMonths = 24;
  method: LoanMethod = 'DECLINING';
  startDate = this.today;

  readonly schedule = signal<LoanSchedule | null>(null);
  readonly error = signal<string | null>(null);
  /** The inputs the visible schedule was computed from (frozen at Calculate time). */
  readonly resultCurrency = signal<CurrencyCode>('USD');
  readonly resultMethod = signal<LoanMethod>('DECLINING');

  constructor() {
    this.calculate();
  }

  setTerm(months: number) {
    this.termMonths = months;
  }

  calculate() {
    this.error.set(null);
    const amount = Number(this.amount);
    const rate = Number(this.ratePct);
    const term = Math.floor(Number(this.termMonths));
    if (!(amount > 0) || !(rate >= 0) || !(term >= 1) || !this.startDate) {
      this.schedule.set(null);
      this.error.set('INVALID');
      return;
    }
    if (term > MAX_TERM_MONTHS) {
      this.schedule.set(null);
      this.error.set('TERM_TOO_LONG');
      return;
    }
    this.schedule.set(
      buildSchedule({
        amount,
        currency: this.currency,
        ratePct: rate,
        ratePeriod: this.ratePeriod,
        termMonths: term,
        method: this.method,
        startDate: this.startDate
      })
    );
    this.resultCurrency.set(this.currency);
    this.resultMethod.set(this.method);
  }

  /** i18n params for the flat-vs-declining comparison strip. */
  cmpParams(s: LoanSchedule): { other: string; diff: string } {
    const cur = this.resultCurrency();
    return {
      other: formatMoney(s.otherMethodTotalInterest, cur),
      diff: formatMoney(Math.abs(s.totalInterest - s.otherMethodTotalInterest), cur)
    };
  }

  exportCsv() {
    const s = this.schedule();
    if (!s) return;
    const cur = this.resultCurrency();
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['No', 'DueDate', 'Payment', 'Principal', 'Interest', 'Balance'];
    const lines = [
      header.join(','),
      ...s.rows.map((r) =>
        [r.no, r.date, r.payment, r.principal, r.interest, r.balance].map(esc).join(',')
      )
    ];
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan_schedule_${formatMoney(Number(this.amount), cur).replace(/[^\d]/g, '')}_${cur}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
