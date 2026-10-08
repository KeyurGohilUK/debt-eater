import { describe, expect, it } from "vitest";
import { isValidInvestmentEntry, summarizeInvestments } from "./investment";
import type { InvestmentEntry } from "./investment";

const entry = (overrides: Partial<InvestmentEntry> = {}): InvestmentEntry => ({
  id: "1",
  date: "2025-01-02",
  provider: "Broker",
  asset: "Index fund",
  category: "Stocks ISA UK",
  currency: "GBP",
  investedMinor: 10_000,
  currentValueMinor: 12_500,
  frequency: "One time",
  scope: "personal",
  ...overrides,
});

describe("investment summaries", () => {
  it("keeps currency totals separate and calculates change only for valued entries", () => {
    expect(
      summarizeInvestments([
        entry(),
        entry({ id: "2", investedMinor: 5_000, currentValueMinor: null }),
        entry({
          id: "3",
          currency: "EUR",
          investedMinor: 2_000,
          currentValueMinor: 2_500,
        }),
      ]),
    ).toEqual([
      {
        currency: "GBP",
        entryCount: 2,
        investedMinor: 15_000,
        valuedEntryCount: 1,
        currentValueMinor: 12_500,
        gainMinor: 2_500,
      },
      {
        currency: "EUR",
        entryCount: 1,
        investedMinor: 2_000,
        valuedEntryCount: 1,
        currentValueMinor: 2_500,
        gainMinor: 500,
      },
    ]);
  });

  it("validates persisted records at the storage boundary", () => {
    expect(isValidInvestmentEntry(entry())).toBe(true);
    expect(isValidInvestmentEntry({ ...entry(), investedMinor: 1.5 })).toBe(
      false,
    );
    expect(isValidInvestmentEntry({ ...entry(), currency: "USD" })).toBe(false);
  });
});
