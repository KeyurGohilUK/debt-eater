import { describe, expect, it } from "vitest";
import {
  Loan,
  formatMoney,
  projectLoan,
  remainingBalanceMinor,
  toMinorUnits,
} from "./loan";

const loan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  name: "Home mortgage",
  scope: "personal",
  currency: "GBP",
  archived: false,
  originalBalanceMinor: toMinorUnits(350_000),
  currentBalanceMinor: toMinorUnits(350_000),
  annualInterestRateBps: 490,
  monthlyPaymentMinor: toMinorUnits(1_780),
  directRepayments: [],
  ...overrides,
});

describe("loan projection", () => {
  it("calculates a finite remaining tenure for an amortising loan", () => {
    const result = projectLoan(loan(), new Date("2026-09-01T00:00:00Z"));
    expect(result.monthsRemaining).not.toBeNull();
    expect(result.monthsRemaining!).toBeGreaterThan(300);
    expect(result.totalInterestMinor!).toBeGreaterThan(0);
  });

  it("deducts direct repayments from principal before projecting tenure", () => {
    const base = projectLoan(loan());
    const repaidLoan = loan({
      directRepayments: [
        { id: "r1", amountMinor: toMinorUnits(50_000), date: "2026-09-01" },
      ],
    });
    const withRepayment = projectLoan(repaidLoan);
    expect(remainingBalanceMinor(repaidLoan)).toBe(toMinorUnits(300_000));
    expect(withRepayment.monthsRemaining!).toBeLessThan(base.monthsRemaining!);
    expect(withRepayment.totalInterestMinor!).toBeLessThan(
      base.totalInterestMinor!,
    );
  });

  it("marks a loan as non-amortising when payment does not cover monthly interest", () => {
    const result = projectLoan(
      loan({ monthlyPaymentMinor: toMinorUnits(100) }),
    );
    expect(result.monthsRemaining).toBeNull();
    expect(result.payoffDate).toBeNull();
  });

  it("never allows direct repayments to produce a negative balance", () => {
    const result = projectLoan(
      loan({
        currentBalanceMinor: toMinorUnits(1_000),
        directRepayments: [
          { id: "r1", amountMinor: toMinorUnits(2_000), date: "2026-09-01" },
        ],
      }),
    );
    expect(result.adjustedBalanceMinor).toBe(0);
    expect(result.monthsRemaining).toBe(0);
  });
});

describe("currency formatting", () => {
  it("formats INR amounts using Indian digit grouping", () => {
    expect(formatMoney(toMinorUnits(1_234_567.89), "INR")).toContain("₹");
    expect(formatMoney(toMinorUnits(1_234_567.89), "INR")).toContain(
      "12,34,567.89",
    );
  });

  it("keeps GBP and INR denominations distinct", () => {
    expect(formatMoney(toMinorUnits(1234.5), "GBP")).toContain("£");
    expect(formatMoney(toMinorUnits(1234.5), "INR")).toContain("₹");
  });
});
