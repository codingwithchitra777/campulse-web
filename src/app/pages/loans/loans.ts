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
  direction: LoanDirection = 'lent';
  counterparty = '';
  principal: number | null = null;
  currency: CurrencyCode = 'USD';
  loanDate = this.today;
  dueDate = '';
  note = '';
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // --- repayment drawer ---
  readonly repayingLoan = signal<Loan | null>(null);
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
      note: this.note.trim() || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.counterparty = '';
        this.principal = null;
        this.dueDate = '';
        this.note = '';
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

  openRepay(loan: Loan) {
    this.repayingLoan.set(loan);
    this.repayAmount = loan.outstanding > 0 ? loan.outstanding : null;
    this.repayDate = this.today;
    this.repayNote = '';
    this.repayError.set(null);
  }

  closeRepay() {
    this.repayingLoan.set(null);
  }

  saveRepayment() {
    const loan = this.repayingLoan();
    if (!loan) return;
    if (!this.repayAmount || this.repayAmount <= 0) {
      this.repayError.set('Enter a positive amount');
      return;
    }
    this.repaySaving.set(true);
    this.repayError.set(null);
    this.api.addRepayment(loan.loanId, {
      amount: this.repayAmount,
      paidDate: this.repayDate || undefined,
      note: this.repayNote.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.repaySaving.set(false);
        this.closeRepay();
        this.receiptNotice.set(res.receiptSent
          ? '✅ Repayment recorded — a receipt was sent to your Telegram to forward.'
          : '✅ Repayment recorded.');
        setTimeout(() => this.receiptNotice.set(null), 6000);
        this.reloadAll();
      },
      error: (err) => {
        this.repaySaving.set(false);
        this.repayError.set(err.error?.detail || 'Failed to record repayment');
      }
    });
  }

  private reloadAll() {
    this.loans.reload();
    this.summary.reload();
  }
}
