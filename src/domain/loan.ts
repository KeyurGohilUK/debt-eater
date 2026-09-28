export type DebtScope = "personal" | "business";
export type Currency = "GBP" | "INR";

export interface DirectRepayment {
  id: string;
  amountMinor: number;
  date: string;
}

export interface Loan {
  id: string;
  name: string;
  scope: DebtScope;
  currency: Currency;
  archived: boolean;
  originalBalanceMinor: number;
  currentBalanceMinor: number;
  annualInterestRateBps: number;
  monthlyPaymentMinor: number;
  directRepayments: DirectRepayment[];
}

export interface LoanProjection {
  adjustedBalanceMinor: number;
  monthsRemaining: number | null;
  totalInterestMinor: number | null;
  payoffDate: Date | null;
  progressPercent: number;
}

export const toMinorUnits = (value: number): number => Math.round(value * 100);
export const fromMinorUnits = (value: number): number => value / 100;

export function formatMoney(value: number, currency: Currency): string {
  const locale = currency === "INR" ? "en-IN" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(value));
}

export function remainingBalanceMinor(loan: Loan): number {
  const direct = loan.directRepayments.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );
  return Math.max(0, loan.currentBalanceMinor - direct);
}

export function projectLoan(loan: Loan, from = new Date()): LoanProjection {
  const balance = remainingBalanceMinor(loan);
  const progress =
    loan.originalBalanceMinor > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((loan.originalBalanceMinor - balance) /
              loan.originalBalanceMinor) *
              100,
          ),
        )
      : 100;

  if (balance === 0) {
    return {
      adjustedBalanceMinor: 0,
      monthsRemaining: 0,
      totalInterestMinor: 0,
      payoffDate: from,
      progressPercent: 100,
    };
  }

  const monthlyRate = loan.annualInterestRateBps / 10_000 / 12;
  const payment = loan.monthlyPaymentMinor;
  const firstInterest = Math.round(balance * monthlyRate);

  if (payment <= firstInterest || payment <= 0) {
    return {
      adjustedBalanceMinor: balance,
      monthsRemaining: null,
      totalInterestMinor: null,
      payoffDate: null,
      progressPercent: progress,
    };
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
    return {
      adjustedBalanceMinor: balance,
      monthsRemaining: null,
      totalInterestMinor: null,
      payoffDate: null,
      progressPercent: progress,
    };
  }

  const payoffDate = new Date(from);
  payoffDate.setMonth(payoffDate.getMonth() + months);
  return {
    adjustedBalanceMinor: balance,
    monthsRemaining: months,
    totalInterestMinor: interestTotal,
    payoffDate,
    progressPercent: progress,
  };
}
