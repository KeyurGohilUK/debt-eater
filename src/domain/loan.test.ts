import { describe, expect, it } from "vitest";
import {
  Loan,
  formatMoney,
  projectLoan,
  summarizeDebts,
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
  nextPaymentDate: "2026-10-01",
  monthlyOverpaymentMinor: 0,
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

describe("debt dashboard summary", () => {
  it("summarizes currencies separately and breaks balances down by scope", () => {
    const summaries = summarizeDebts(
      [
        loan({ currentBalanceMinor: toMinorUnits(10_000) }),
        loan({
          id: "business-gbp",
          scope: "business",
          currentBalanceMinor: toMinorUnits(5_000),
          monthlyPaymentMinor: toMinorUnits(300),
        }),
        loan({
          id: "personal-inr",
          currency: "INR",
          currentBalanceMinor: toMinorUnits(20_000),
          monthlyPaymentMinor: toMinorUnits(700),
        }),
        loan({ id: "archived", archived: true }),
      ],
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      currency: "GBP",
      debtMinor: toMinorUnits(15_000),
      personalDebtMinor: toMinorUnits(10_000),
      businessDebtMinor: toMinorUnits(5_000),
      monthlyPaymentMinor: toMinorUnits(2_080),
      personalMonthlyPaymentMinor: toMinorUnits(1_780),
      businessMonthlyPaymentMinor: toMinorUnits(300),
    });
    expect(summaries[1]).toMatchObject({
      currency: "INR",
      debtMinor: toMinorUnits(20_000),
      monthlyPaymentMinor: toMinorUnits(700),
    });
  });

  it("excludes cleared balances from monthly payments and leaves uncertain payoff dates blank", () => {
    const summary = summarizeDebts(
      [
        loan({
          currentBalanceMinor: toMinorUnits(1_000),
          directRepayments: [
            { id: "r1", amountMinor: toMinorUnits(1_000), date: "2026-09-01" },
          ],
          monthlyPaymentMinor: toMinorUnits(500),
        }),
        loan({
          id: "non-amortising",
          scope: "business",
          currentBalanceMinor: toMinorUnits(5_000),
          monthlyPaymentMinor: toMinorUnits(1),
        }),
      ],
      new Date("2026-09-01T00:00:00Z"),
    );

    expect(summary[0]!.monthlyPaymentMinor).toBe(toMinorUnits(1));
    expect(summary[0]!.projectedPayoffDate).toBeNull();
  });
});

describe("planned monthly overpayments", () => {
  it("includes planned monthly overpayments in payoff projections", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    const regular = projectLoan(loan(), from);
    const withOverpayment = projectLoan(
      loan({ monthlyOverpaymentMinor: toMinorUnits(300) }),
      from,
    );

    expect(withOverpayment.monthsRemaining!).toBeLessThan(
      regular.monthsRemaining!,
    );
  });

  it("anchors the payoff date to the next scheduled debit", () => {
    const result = projectLoan(
      loan({
        currentBalanceMinor: toMinorUnits(2_000),
        originalBalanceMinor: toMinorUnits(2_000),
        annualInterestRateBps: 0,
        monthlyPaymentMinor: toMinorUnits(1_000),
        nextPaymentDate: "2026-10-15",
      }),
      new Date("2026-09-30T00:00:00Z"),
    );
    expect(result.monthsRemaining).toBe(2);
    expect(result.payoffDate?.toISOString().slice(0, 10)).toBe("2026-11-15");
  });

  it("reports planned overpayments separately in each currency summary", () => {
    const summary = summarizeDebts([
      loan({ monthlyOverpaymentMinor: toMinorUnits(200) }),
      loan({
        id: "business-inr",
        currency: "INR",
        scope: "business",
        monthlyOverpaymentMinor: toMinorUnits(500),
      }),
    ]);

    expect(
      summary.map(({ monthlyOverpaymentMinor }) => monthlyOverpaymentMinor),
    ).toEqual([toMinorUnits(200), toMinorUnits(500)]);
  });
});
