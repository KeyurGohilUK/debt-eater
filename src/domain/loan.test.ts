import { describe, expect, it } from 'vitest';
import { Loan, poundsToPence, projectLoan, remainingBalancePence } from './loan';

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan-1',
  name: 'Home mortgage',
  scope: 'personal',
  originalBalancePence: poundsToPence(350_000),
  currentBalancePence: poundsToPence(350_000),
  annualInterestRateBps: 490,
  monthlyPaymentPence: poundsToPence(1_780),
  directRepayments: [],
  ...overrides,
});

describe('loan projection', () => {
  it('calculates a finite remaining tenure for an amortising loan', () => {
    const result = projectLoan(loan(), new Date('2026-09-01T00:00:00Z'));
    expect(result.monthsRemaining).not.toBeNull();
    expect(result.monthsRemaining!).toBeGreaterThan(300);
    expect(result.totalInterestPence!).toBeGreaterThan(0);
  });

  it('deducts direct repayments from principal before projecting tenure', () => {
    const base = projectLoan(loan());
    const withRepayment = projectLoan(loan({ directRepayments: [{ id: 'r1', amountPence: poundsToPence(50_000), date: '2026-09-01' }] }));
    expect(remainingBalancePence(loan({ directRepayments: [{ id: 'r1', amountPence: poundsToPence(50_000), date: '2026-09-01' }] }))).toBe(poundsToPence(300_000));
    expect(withRepayment.monthsRemaining!).toBeLessThan(base.monthsRemaining!);
    expect(withRepayment.totalInterestPence!).toBeLessThan(base.totalInterestPence!);
  });

  it('marks a loan as non-amortising when EMI does not cover monthly interest', () => {
    const result = projectLoan(loan({ monthlyPaymentPence: poundsToPence(100) }));
    expect(result.monthsRemaining).toBeNull();
    expect(result.payoffDate).toBeNull();
  });

  it('never allows direct repayments to produce a negative balance', () => {
    const result = projectLoan(loan({ currentBalancePence: poundsToPence(1_000), directRepayments: [{ id: 'r1', amountPence: poundsToPence(2_000), date: '2026-09-01' }] }));
    expect(result.adjustedBalancePence).toBe(0);
    expect(result.monthsRemaining).toBe(0);
  });
});
