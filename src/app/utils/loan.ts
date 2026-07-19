import { CurrencyCode } from '../models';

/**
 * Pure loan-amortization math for the Loan Calculator page. Framework-free so
 * it can be unit-tested directly.
 *
 * Two methods, matching how loans are quoted in Cambodia:
 * - DECLINING: standard EMI — interest accrues on the outstanding balance.
 * - FLAT: interest is charged on the *original* principal every month (the
 *   common quoting style of local banks/MFIs; it understates the true cost).
 */
export type LoanMethod = 'DECLINING' | 'FLAT';
export type RatePeriod = 'MONTH' | 'YEAR';

export const MAX_TERM_MONTHS = 480;

export interface LoanInput {
  amount: number;
  currency: CurrencyCode;
  /** Interest rate in percent, per `ratePeriod`. */
  ratePct: number;
  ratePeriod: RatePeriod;
  termMonths: number;
  method: LoanMethod;
  /** First payment falls one month after this date (YYYY-MM-DD). */
  startDate: string;
  /** Optional. If provided, overrides the mathematically calculated EMI/flat payment for the first n-1 months. */
  fixedMonthlyPayment?: number;
}

export interface ScheduleRow {
  no: number;
  /** Due date as YYYY-MM-DD. */
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanSchedule {
  rows: ScheduleRow[];
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  /** Total interest the same inputs would cost under the other method. */
  otherMethodTotalInterest: number;
}

/** Round to the currency's minor unit — KHR is whole, USD keeps cents. */
function roundMoney(value: number, currency: CurrencyCode): number {
  return currency === 'USD' ? Math.round(value * 100) / 100 : Math.round(value);
}

function monthlyRate(input: LoanInput): number {
  return input.ratePeriod === 'MONTH' ? input.ratePct / 100 : input.ratePct / 1200;
}

/** Step `months` whole months from an YYYY-MM-DD date, clamping the day-of-month. */
function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(d, daysInMonth);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Constant monthly payment for a declining-balance (EMI) loan. Unrounded. */
function emiPayment(principal: number, r: number, n: number): number {
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function totalInterestFor(input: LoanInput, method: LoanMethod): number {
  const r = monthlyRate(input);
  const n = input.termMonths;
  if (method === 'FLAT') return roundMoney(input.amount * r * n, input.currency);
  return roundMoney(emiPayment(input.amount, r, n) * n - input.amount, input.currency);
}

/**
 * Calculate the required term (months) from a target monthly payment.
 * Returns the exact decimal term or null if the payment is too low.
 */
export function calculateTermFromPayment(
  amount: number,
  ratePct: number,
  ratePeriod: RatePeriod,
  method: LoanMethod,
  targetPayment: number
): number | null {
  const r = ratePeriod === 'MONTH' ? ratePct / 100 : ratePct / 1200;
  
  if (method === 'FLAT') {
    const flatInterestPerMonth = amount * r;
    // Payment must cover at least the monthly interest
    if (targetPayment <= flatInterestPerMonth) {
      return null;
    }
    const principalPerMonth = targetPayment - flatInterestPerMonth;
    return amount / principalPerMonth;
  } else {
    // DECLINING: n = -log(1 - (P * r) / M) / log(1 + r)
    if (r === 0) {
      if (targetPayment <= 0) return null;
      return amount / targetPayment;
    }
    
    const monthlyInterest = amount * r;
    if (targetPayment <= monthlyInterest) {
      return null; // Payment too low to cover interest
    }
    
    const x = 1 - (amount * r) / targetPayment;
    return -Math.log(x) / Math.log(1 + r);
  }
}

/**
 * Build the full repayment schedule. Rows are rounded to the currency's minor
 * unit; the final row absorbs the accumulated rounding drift so the balance
 * lands exactly on zero.
 */
export function buildSchedule(input: LoanInput): LoanSchedule {
  const currency = input.currency;
  const n = Math.min(Math.max(1, Math.floor(input.termMonths)), MAX_TERM_MONTHS);
  const P = input.amount;
  const r = monthlyRate(input);

  const rows: ScheduleRow[] = [];
  let balance = P;
  let totalInterest = 0;

  const flatInterest = roundMoney(P * r, currency);
  let flatPrincipal = roundMoney(P / n, currency);
  let emi = roundMoney(emiPayment(P, r, n), currency);

  if (input.fixedMonthlyPayment && input.fixedMonthlyPayment > 0) {
    if (input.method === 'FLAT') {
      flatPrincipal = roundMoney(input.fixedMonthlyPayment - flatInterest, currency);
    } else {
      emi = roundMoney(input.fixedMonthlyPayment, currency);
    }
  }

  for (let i = 1; i <= n; i++) {
    const last = i === n;
    let interest: number;
    let principal: number;
    if (input.method === 'FLAT') {
      interest = flatInterest;
      // Last row: pay off whatever principal is actually left.
      principal = last ? balance : flatPrincipal;
    } else {
      interest = roundMoney(balance * r, currency);
      principal = last ? balance : roundMoney(emi - interest, currency);
    }
    const payment = roundMoney(principal + interest, currency);
    balance = roundMoney(balance - principal, currency);
    totalInterest = roundMoney(totalInterest + interest, currency);
    rows.push({ no: i, date: addMonths(input.startDate, i), payment, principal, interest, balance });
  }

  const totalPayment = roundMoney(P + totalInterest, currency);
  const monthlyPayment = input.method === 'FLAT' ? roundMoney(flatPrincipal + flatInterest, currency) : emi;
  const otherMethod: LoanMethod = input.method === 'FLAT' ? 'DECLINING' : 'FLAT';

  return {
    rows,
    monthlyPayment,
    totalPayment,
    totalInterest,
    otherMethodTotalInterest: totalInterestFor({ ...input, termMonths: n }, otherMethod)
  };
}
