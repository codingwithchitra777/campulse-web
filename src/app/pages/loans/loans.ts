import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { MoneyPipe } from '../../utils/money';
import { CurrencyCode, Loan, LoanDirection, LoanSummaryRow } from '../../models';
import { TranslatePipe } from '@ngx-translate/core';
import { LoanMethod, LoanSchedule, MAX_TERM_MONTHS, RatePeriod, buildSchedule, calculateTermFromPayment } from '../../utils/loan';
import { formatMoney } from '../../utils/money';

/**
 * Personal loan ledger — money lent to / borrowed from people. Deliberately
 * separate from trading: this never touches P/L or the portfolio. Recording a
 * repayment sends the user a forwardable Telegram receipt (see backend).
 */
@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MoneyPipe, TranslatePipe],
  templateUrl: './loans.html'
})
export class LoansComponent {
  private readonly api = inject(ApiService);
  protected readonly session = inject(SessionService);

  readonly loans = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getLoans(),
    defaultValue: { items: [] as Loan[], deliverable: true }
  });

  readonly summary = rxResource({
    params: () => this.session.activeUserId(),
    stream: () => this.api.getLoanSummary(),
    defaultValue: { items: [] as LoanSummaryRow[] }
  });

  readonly showSettled = signal(false);

  private visible = computed(() =>
    this.loans.value().items.filter(l => this.showSettled() || l.status !== 'settled'));

  readonly lent = computed(() => this.visible().filter(l => l.direction === 'lent'));
  readonly borrowed = computed(() => this.visible().filter(l => l.direction === 'borrowed'));

  readonly lentSummary = computed(() => this.summary.value().items.filter(s => s.direction === 'lent' && s.outstanding > 0));
  readonly borrowedSummary = computed(() => this.summary.value().items.filter(s => s.direction === 'borrowed' && s.outstanding > 0));

  readonly today = new Date().toISOString().split('T')[0];

  // --- create form ---
  readonly addingLoan = signal(false);
  direction: LoanDirection = 'lent';
  counterparty = '';
  principal: number | null = null;
  currency: CurrencyCode = 'USD';
  loanDate = this.today;
  dueDate = '';
  note = '';
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // --- calculator extensions ---
  readonly showCalculator = signal(false);
  readonly MAX_TERM = MAX_TERM_MONTHS;
  readonly termChips = [12, 24, 36, 60];
  ratePct = 1.5;
  ratePeriod: RatePeriod = 'MONTH';
  termMonths = 24;
  calcMode: 'TERM' | 'PAYMENT' = 'TERM';
  targetPayment = 500;
  method: LoanMethod = 'DECLINING';
  readonly schedule = signal<LoanSchedule | null>(null);
  readonly calcError = signal<string | null>(null);
  readonly resultCurrency = signal<CurrencyCode>('USD');

  openAdd() {
    this.addingLoan.set(true);
    this.direction = 'lent';
    this.counterparty = '';
    this.principal = null;
    this.currency = 'USD';
    this.loanDate = this.today;
    this.dueDate = '';
    this.note = '';
    this.error.set(null);
    
    this.showCalculator.set(false);
    this.schedule.set(null);
    this.calcError.set(null);
    this.ratePct = 1.5;
    this.termMonths = 24;
    this.targetPayment = 500;
  }

  closeAdd() {
    this.addingLoan.set(false);
  }

  toggleCalculator() {
    this.showCalculator.set(!this.showCalculator());
  }

  setTerm(months: number) {
    this.termMonths = months;
  }

  calculateSchedule() {
    this.calcError.set(null);
    const amount = Number(this.principal);
    const rate = Number(this.ratePct);
    let term = Math.floor(Number(this.termMonths));

    if (!(amount > 0) || !(rate >= 0) || !this.loanDate) {
      this.schedule.set(null);
      this.calcError.set('INVALID');
      return;
    }

    if (this.calcMode === 'PAYMENT') {
      const payment = Number(this.targetPayment);
      if (!(payment > 0)) {
        this.schedule.set(null);
        this.calcError.set('INVALID');
        return;
      }
      const calculatedTerm = calculateTermFromPayment(amount, rate, this.ratePeriod, this.method, payment);
      if (calculatedTerm === null) {
        this.schedule.set(null);
        this.calcError.set('PAYMENT_TOO_LOW');
        return;
      }
      term = Math.ceil(calculatedTerm);
      this.termMonths = term;
    }

    if (!(term >= 1)) {
      this.schedule.set(null);
      this.calcError.set('INVALID');
      return;
    }
    if (term > MAX_TERM_MONTHS) {
      this.schedule.set(null);
      this.calcError.set('TERM_TOO_LONG');
      return;
    }

    const s = buildSchedule({
      amount,
      currency: this.currency,
      ratePct: rate,
      ratePeriod: this.ratePeriod,
      termMonths: term,
      method: this.method,
      startDate: this.loanDate,
      fixedMonthlyPayment: this.calcMode === 'PAYMENT' ? Number(this.targetPayment) : undefined
    });
    this.schedule.set(s);
    this.resultCurrency.set(this.currency);

    if (s.rows.length > 0) {
       this.dueDate = s.rows[s.rows.length - 1].date;
    }
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
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loan_schedule_${formatMoney(Number(this.principal || 0), cur).replace(/[^\d]/g, '')}_${cur}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- repayment drawer ---
  readonly viewingSchedule = signal<Loan | null>(null);
  readonly currentSchedule = signal<LoanSchedule | null>(null);
  
  readonly mappedScheduleRows = computed(() => {
    const s = this.currentSchedule();
    const l = this.viewingSchedule();
    if (!s || !l) return [];
    
    let repaidSoFar = l.repaid;
    return s.rows.map(r => {
      let status: 'Paid' | 'Pending' = 'Pending';
      if (repaidSoFar >= r.payment - 0.005) {
        status = 'Paid';
        repaidSoFar -= r.payment;
      } else {
        status = 'Pending';
        repaidSoFar = 0;
      }
      return { ...r, status };
    });
  });
  repayAmount: number | null = null;
  repayDate = this.today;
  repayNote = '';
  readonly repaySaving = signal(false);
  readonly repayError = signal<string | null>(null);
  readonly receiptNotice = signal<string | null>(null);

  save() {
    const counterparty = this.counterparty.trim();
    if (!counterparty || !this.principal || this.principal <= 0) {
      this.error.set('Enter a name and a positive amount');
      return;
    }
    if (this.dueDate && this.dueDate < this.loanDate) {
      this.error.set('Due date is before the loan date');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.api.createLoan({
      direction: this.direction,
      counterparty,
      principal: this.principal,
      currency: this.currency,
      loanDate: this.loanDate || undefined,
      dueDate: this.dueDate || undefined,
      note: this.note.trim() || undefined,
      ratePct: this.schedule() ? Number(this.ratePct) : undefined,
      ratePeriod: this.schedule() ? this.ratePeriod : undefined,
      termMonths: this.schedule() ? Number(this.termMonths) : undefined,
      method: this.schedule() ? this.method : undefined,
      fixedPayment: this.schedule() && this.calcMode === 'PAYMENT' ? Number(this.targetPayment) : undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdd();
        this.reloadAll();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.detail || 'Failed to save');
      }
    });
  }

  remove(loan: Loan) {
    this.api.deleteLoan(loan.loanId).subscribe({
      next: () => this.reloadAll(),
      error: (err) => this.error.set(err.error?.detail || 'Failed to delete')
    });
  }

  openSchedule(loan: Loan) {
    this.viewingSchedule.set(loan);
    this.repayAmount = loan.outstanding > 0 ? loan.outstanding : null;
    this.repayDate = this.today;
    this.repayNote = '';
    this.repayError.set(null);
    
    if (loan.ratePct != null && loan.termMonths != null && loan.method && loan.ratePeriod) {
      const s = buildSchedule({
        amount: loan.principal,
        currency: loan.currency,
        ratePct: loan.ratePct,
        ratePeriod: loan.ratePeriod,
        termMonths: loan.termMonths,
        method: loan.method,
        startDate: loan.loanDate,
        fixedMonthlyPayment: loan.fixedPayment
      });
      this.currentSchedule.set(s);
    } else {
      this.currentSchedule.set(null);
    }
  }

  payRow(amount: number, date: string) {
    if (!confirm(`Confirm payment of ${formatMoney(amount, this.viewingSchedule()?.currency || 'USD')} on ${date}?`)) return;
    const loan = this.viewingSchedule();
    if (!loan) return;
    
    this.repaySaving.set(true);
    this.repayError.set(null);
    this.api.addRepayment(loan.loanId, {
      amount,
      paidDate: date,
      note: 'Schedule Payment'
    }).subscribe({
      next: (res) => {
        this.repaySaving.set(false);
        this.closeSchedule();
        this.receiptNotice.set(res.receiptSent
          ? '✅ Repayment recorded — a receipt was sent to your Telegram to forward.'
          : '✅ Repayment recorded.');
        setTimeout(() => this.receiptNotice.set(null), 6000);
        this.reloadAll();
      },
      error: (err) => {
        this.repaySaving.set(false);
        alert(err.error?.detail || 'Failed to record repayment');
      }
    });
  }

  closeSchedule() {
    this.viewingSchedule.set(null);
    this.currentSchedule.set(null);
  }

  private reloadAll() {
    this.loans.reload();
    this.summary.reload();
  }
}
