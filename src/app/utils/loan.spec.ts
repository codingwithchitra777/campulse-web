import { buildSchedule, LoanInput } from './loan';

const base: LoanInput = {
  amount: 10000,
  currency: 'USD',
  ratePct: 1,
  ratePeriod: 'MONTH',
  termMonths: 12,
  method: 'DECLINING',
  startDate: '2026-01-15'
};

describe('buildSchedule', () => {
  it('computes the standard EMI for declining balance', () => {
    const s = buildSchedule(base);
    // Known value: 10,000 @ 1%/month over 12 months.
    expect(s.monthlyPayment).toBe(888.49);
    expect(s.rows.length).toBe(12);
    expect(s.rows[11].balance).toBe(0);
    expect(s.totalPayment).toBeCloseTo(10000 + s.totalInterest, 2);
    // First month interest is 1% of the full principal.
    expect(s.rows[0].interest).toBe(100);
  });

  it('charges flat interest on the original principal every month', () => {
    const s = buildSchedule({ ...base, ratePct: 1.5, termMonths: 24, method: 'FLAT' });
    expect(s.rows.every((r) => r.interest === 150)).toBe(true);
    expect(s.totalInterest).toBe(3600);
    expect(s.rows[23].balance).toBe(0);
    // Same inputs cost less on declining balance.
    expect(s.otherMethodTotalInterest).toBeLessThan(3600);
  });

  it('handles a zero interest rate', () => {
    const s = buildSchedule({ ...base, ratePct: 0, termMonths: 10 });
    expect(s.monthlyPayment).toBe(1000);
    expect(s.totalInterest).toBe(0);
    expect(s.rows[9].balance).toBe(0);
  });

  it('rounds KHR to whole riel and still lands on zero', () => {
    const s = buildSchedule({
      ...base,
      amount: 4000000,
      currency: 'KHR',
      ratePct: 1.5,
      termMonths: 7
    });
    for (const row of s.rows) {
      expect(Number.isInteger(row.payment)).toBe(true);
      expect(Number.isInteger(row.principal)).toBe(true);
      expect(Number.isInteger(row.interest)).toBe(true);
      expect(Number.isInteger(row.balance)).toBe(true);
    }
    expect(s.rows[6].balance).toBe(0);
    const paidPrincipal = s.rows.reduce((sum, r) => sum + r.principal, 0);
    expect(paidPrincipal).toBe(4000000);
  });

  it('steps due dates monthly and clamps the day of month', () => {
    const s = buildSchedule({ ...base, termMonths: 3, startDate: '2026-01-31' });
    expect(s.rows.map((r) => r.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });
});
