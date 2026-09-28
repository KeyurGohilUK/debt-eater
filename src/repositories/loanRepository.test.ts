import { describe, expect, it } from "vitest";
import { createLocalLoanRepository } from "./loanRepository";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("local loan repository", () => {
  it("migrates stored GBP balances and repayment history without changing values", () => {
    const storage = memoryStorage({
      "debt-eater.loans.v1": JSON.stringify([
        {
          id: "loan-1",
          name: "Mortgage",
          scope: "personal",
          originalBalancePence: 34567890,
          currentBalancePence: 34067890,
          annualInterestRateBps: 450,
          monthlyPaymentPence: 150000,
          directRepayments: [
            { id: "repay-1", amountPence: 500000, date: "2026-09-01" },
          ],
        },
      ]),
    });

    const repository = createLocalLoanRepository(storage);
    const [loan] = repository.list();

    expect(loan).toMatchObject({
      currency: "GBP",
      archived: false,
      originalBalanceMinor: 34567890,
      currentBalanceMinor: 34067890,
      monthlyPaymentMinor: 150000,
      directRepayments: [
        { id: "repay-1", amountMinor: 500000, date: "2026-09-01" },
      ],
    });
    expect(JSON.parse(storage.getItem("debt-eater.loans.v2")!)).toEqual([loan]);
    expect(repository.list()).toEqual([loan]);
  });

  it("prefers the current storage format when both formats exist", () => {
    const current = [
      {
        id: "new-loan",
        name: "India loan",
        scope: "personal",
        currency: "INR",
        archived: false,
        originalBalanceMinor: 100000,
        currentBalanceMinor: 100000,
        annualInterestRateBps: 800,
        monthlyPaymentMinor: 10000,
        directRepayments: [],
      },
    ];
    const storage = memoryStorage({
      "debt-eater.loans.v1": "[]",
      "debt-eater.loans.v2": JSON.stringify(current),
    });

    expect(createLocalLoanRepository(storage).list()).toEqual(current);
  });
});
