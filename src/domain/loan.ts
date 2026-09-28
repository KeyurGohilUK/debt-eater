export type DebtScope = 'personal' | 'business';

export interface DirectRepayment {
  id: string;
  amountPence: number;
  date: string;
}

export interface Loan {
  id: string;
  name: string;
  scope: DebtScope;
  originalBalancePence: number;
  currentBalancePence: number;
  annualInterestRateBps: number;
  monthlyPaymentPence: number;
  directRepayments: DirectRepayment[];
}

export interface LoanProjection {
  adjustedBalancePence: number;
  monthsRemaining: number | null;
  totalInterestPence: number | null;
  payoffDate: Date | null;
  progressPercent: number;
}

export const poundsToPence = (value: number): number => Math.round(value * 100);
export const penceToPounds = (value: number): number => value / 100;

export function remainingBalancePence(loan: Loan): number {
  const direct = loan.directRepayments.reduce((sum, item) => sum + item.amountPence, 0);
  return Math.max(0, loan.currentBalancePence - direct);
}

export function projectLoan(loan: Loan, from = new Date()): LoanProjection {
  const balance = remainingBalancePence(loan);
  const progress = loan.originalBalancePence > 0
    ? Math.min(100, Math.max(0, ((loan.originalBalancePence - balance) / loan.originalBalancePence) * 100))
    : 100;

  if (balance === 0) {
    return { adjustedBalancePence: 0, monthsRemaining: 0, totalInterestPence: 0, payoffDate: from, progressPercent: 100 };
  }

  const monthlyRate = loan.annualInterestRateBps / 10_000 / 12;
  const payment = loan.monthlyPaymentPence;
  const firstInterest = Math.round(balance * monthlyRate);

  if (payment <= firstInterest || payment <= 0) {
    return { adjustedBalancePence: balance, monthsRemaining: null, totalInterestPence: null, payoffDate: null, progressPercent: progress };
  }

  let outstanding = balance;
  let interestTotal = 0;
  let months = 0;
  const maxMonths = 1_200;

  while (outstanding > 0 && months < maxMonths) {
    const interest = Math.round(outstanding * monthlyRate);
    interestTotal += interest;
    outstanding = Math.max(0, outstanding + interest - payment);
    months += 1;
  }

  if (outstanding > 0) {
    return { adjustedBalancePence: balance, monthsRemaining: null, totalInterestPence: null, payoffDate: null, progressPercent: progress };
  }

  const payoffDate = new Date(from);
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return { adjustedBalancePence: balance, monthsRemaining: months, totalInterestPence: interestTotal, payoffDate, progressPercent: progress };
}
