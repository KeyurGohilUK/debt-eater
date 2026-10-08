export type DebtScope = "personal" | "business";
export type { Currency } from "./money";
export { formatMoney, fromMinorUnits, toMinorUnits } from "./money";
import type { Currency } from "./money";

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
  nextPaymentDate: string;
  monthlyOverpaymentMinor: number;
  directRepayments: DirectRepayment[];
}

export interface LoanProjection {
  adjustedBalanceMinor: number;
  monthsRemaining: number | null;
  totalInterestMinor: number | null;
  payoffDate: Date | null;
  progressPercent: number;
  balanceTrajectoryMinor?: number[];
}

export interface LoanSimulation {
  baseline: LoanProjection;
  scenario: LoanProjection;
  monthsSaved: number | null;
  interestSavedMinor: number | null;
}

export interface LoanSimulationInput {
  additionalMonthlyPaymentMinor: number;
  lumpSumMinor: number;
}

export function monthlyPaymentTotalMinor(loan: Loan): number {
  return loan.monthlyPaymentMinor + Math.max(0, loan.monthlyOverpaymentMinor);
}

export function remainingBalanceMinor(loan: Loan): number {
  const direct = loan.directRepayments.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );
  return Math.max(0, loan.currentBalanceMinor - direct);
}

export function projectLoan(
  loan: Loan,
  from = new Date(),
  options: Partial<LoanSimulationInput> & { includeTrajectory?: boolean } = {},
): LoanProjection {
  const lumpSumMinor = validSimulationAmount(options.lumpSumMinor);
  const additionalMonthlyPaymentMinor = validSimulationAmount(
    options.additionalMonthlyPaymentMinor,
  );
  const balance = Math.max(0, remainingBalanceMinor(loan) - lumpSumMinor);
  const trajectory = options.includeTrajectory ? [balance] : undefined;
  const result = (
    values: Omit<LoanProjection, "balanceTrajectoryMinor">,
  ): LoanProjection =>
    trajectory ? { ...values, balanceTrajectoryMinor: trajectory } : values;
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
    return result({
      adjustedBalanceMinor: 0,
      monthsRemaining: 0,
      totalInterestMinor: 0,
      payoffDate: from,
      progressPercent: 100,
    });
  }

  const monthlyRate = loan.annualInterestRateBps / 10_000 / 12;
  const payment =
    monthlyPaymentTotalMinor(loan) + additionalMonthlyPaymentMinor;
  const firstInterest = Math.round(balance * monthlyRate);

  if (payment <= firstInterest || payment <= 0) {
    return result({
      adjustedBalanceMinor: balance,
      monthsRemaining: null,
      totalInterestMinor: null,
      payoffDate: null,
      progressPercent: progress,
    });
  }

  let outstanding = balance;
  let interestTotal = 0;
  let months = 0;
  const maxMonths = 1_200;

  while (outstanding > 0 && months < maxMonths) {
    const interest = Math.round(outstanding * monthlyRate);
    interestTotal += interest;
    outstanding = Math.max(0, outstanding + interest - payment);
    trajectory?.push(outstanding);
    months += 1;
  }

  if (outstanding > 0) {
    return result({
      adjustedBalanceMinor: balance,
      monthsRemaining: null,
      totalInterestMinor: null,
      payoffDate: null,
      progressPercent: progress,
    });
  }

  const scheduledDate = new Date(`${loan.nextPaymentDate}T12:00:00`);
  const payoffDate = Number.isNaN(scheduledDate.getTime())
    ? new Date(from)
    : scheduledDate;
  payoffDate.setMonth(payoffDate.getMonth() + months - 1);
  return result({
    adjustedBalanceMinor: balance,
    monthsRemaining: months,
    totalInterestMinor: interestTotal,
    payoffDate,
    progressPercent: progress,
  });
}

export function simulateLoan(
  loan: Loan,
  input: LoanSimulationInput,
  from = new Date(),
): LoanSimulation {
  const baseline = projectLoan(loan, from, { includeTrajectory: true });
  const scenario = projectLoan(loan, from, {
    ...input,
    includeTrajectory: true,
  });

  return {
    baseline,
    scenario,
    monthsSaved:
      baseline.monthsRemaining === null || scenario.monthsRemaining === null
        ? null
        : Math.max(0, baseline.monthsRemaining - scenario.monthsRemaining),
    interestSavedMinor:
      baseline.totalInterestMinor === null ||
      scenario.totalInterestMinor === null
        ? null
        : Math.max(
            0,
            baseline.totalInterestMinor - scenario.totalInterestMinor,
          ),
  };
}

function validSimulationAmount(amount: number | undefined): number {
  return typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount > 0
    ? amount
    : 0;
}

export interface CurrencyDebtSummary {
  currency: Currency;
  debtCount: number;
  debtMinor: number;
  originalDebtMinor: number;
  personalDebtMinor: number;
  businessDebtMinor: number;
  monthlyPaymentMinor: number;
  monthlyOverpaymentMinor: number;
  personalMonthlyPaymentMinor: number;
  businessMonthlyPaymentMinor: number;
  progressPercent: number;
  projectedPayoffDate: Date | null;
}

export function summarizeDebts(
  loans: readonly Loan[],
  from = new Date(),
): CurrencyDebtSummary[] {
  const active = loans.filter((loan) => !loan.archived);
  return (["GBP", "EUR", "INR"] as const)
    .map((currency) => {
      const currencyLoans = active.filter((loan) => loan.currency === currency);
      if (currencyLoans.length === 0) return null;

      const projected = currencyLoans.map((loan) => ({
        loan,
        projection: projectLoan(loan, from),
      }));
      const debtMinor = projected.reduce(
        (sum, item) => sum + item.projection.adjustedBalanceMinor,
        0,
      );
      const originalDebtMinor = projected.reduce(
        (sum, item) => sum + item.loan.originalBalanceMinor,
        0,
      );
      const personalDebtMinor = projected
        .filter(({ loan }) => loan.scope === "personal")
        .reduce((sum, item) => sum + item.projection.adjustedBalanceMinor, 0);
      const businessDebtMinor = projected
        .filter(({ loan }) => loan.scope === "business")
        .reduce((sum, item) => sum + item.projection.adjustedBalanceMinor, 0);
      const monthlyPaymentMinor = projected.reduce(
        (sum, item) =>
          sum +
          (item.projection.adjustedBalanceMinor > 0
            ? item.loan.monthlyPaymentMinor
            : 0),
        0,
      );
      const monthlyOverpaymentMinor = projected.reduce(
        (sum, item) =>
          sum +
          (item.projection.adjustedBalanceMinor > 0
            ? Math.max(0, item.loan.monthlyOverpaymentMinor)
            : 0),
        0,
      );
      const personalMonthlyPaymentMinor = projected
        .filter(
          ({ loan, projection }) =>
            loan.scope === "personal" && projection.adjustedBalanceMinor > 0,
        )
        .reduce((sum, item) => sum + item.loan.monthlyPaymentMinor, 0);
      const businessMonthlyPaymentMinor = projected
        .filter(
          ({ loan, projection }) =>
            loan.scope === "business" && projection.adjustedBalanceMinor > 0,
        )
        .reduce((sum, item) => sum + item.loan.monthlyPaymentMinor, 0);
      const progressPercent =
        originalDebtMinor > 0
          ? Math.min(
              100,
              Math.max(
                0,
                ((originalDebtMinor - debtMinor) / originalDebtMinor) * 100,
              ),
            )
          : 100;
      const outstanding = projected.filter(
        ({ projection }) => projection.adjustedBalanceMinor > 0,
      );
      const projectedPayoffDate =
        outstanding.length === 0
          ? new Date(from)
          : outstanding.some(({ projection }) => projection.payoffDate === null)
            ? null
            : new Date(
                Math.max(
                  ...outstanding.map(({ projection }) =>
                    projection.payoffDate!.getTime(),
                  ),
                ),
              );

      return {
        currency,
        debtCount: currencyLoans.length,
        debtMinor,
        originalDebtMinor,
        personalDebtMinor,
        businessDebtMinor,
        monthlyPaymentMinor,
        monthlyOverpaymentMinor,
        personalMonthlyPaymentMinor,
        businessMonthlyPaymentMinor,
        progressPercent,
        projectedPayoffDate,
      };
    })
    .filter((summary): summary is CurrencyDebtSummary => summary !== null);
}
