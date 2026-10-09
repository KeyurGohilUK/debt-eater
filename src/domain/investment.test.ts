import { describe, expect, it } from "vitest";
import {
  bullionValueMinor,
  isValidInvestmentEntry,
  resolveInvestmentValues,
  summarizeInvestments,
} from "./investment";
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
    expect(
      isValidInvestmentEntry({
        ...entry(),
        bullion: {
          metal: "gold",
          holdingType: "physical",
          quantity: 2,
          weightPerItem: 1,
          weightUnit: "toz",
          purity: 999.9,
        },
      }),
    ).toBe(true);
    expect(
      isValidInvestmentEntry({
        ...entry(),
        bullion: {
          metal: "gold",
          holdingType: "physical",
          quantity: 1,
          weightPerItem: 1,
          weightUnit: "toz",
          purity: 1001,
        },
      }),
    ).toBe(false);
  });

  it("values fine metal weight from spot and currency rates", () => {
    const prices = {
      fetchedAt: "2026-10-09T08:00:00.000Z",
      usdPerTroyOunce: { gold: 3000, silver: 30 },
      usdRates: { GBP: 0.75, EUR: 0.9, INR: 83 },
    };
    const holding = {
      metal: "gold" as const,
      holdingType: "physical" as const,
      quantity: 2,
      weightPerItem: 1,
      weightUnit: "toz" as const,
      purity: 999.9,
    };

    expect(bullionValueMinor(holding, "GBP", prices)).toBe(449_955);
    expect(
      resolveInvestmentValues(
        [entry({ bullion: holding, currentValueMinor: null })],
        prices,
      ).get("1"),
    ).toBe(449_955);
  });

  it("uses automatic values in currency summaries", () => {
    expect(
      summarizeInvestments(
        [entry({ currentValueMinor: null })],
        new Map([["1", 13_000]]),
      )[0],
    ).toMatchObject({
      valuedEntryCount: 1,
      currentValueMinor: 13_000,
      gainMinor: 3_000,
    });
  });
});
