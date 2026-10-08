import { describe, expect, it, vi } from "vitest";
import { createInvestmentRepository } from "./investmentRepository";
import type { InvestmentEntry } from "../domain/investment";

const sample: InvestmentEntry = {
  id: "entry-1",
  date: "2025-01-02",
  provider: "Broker",
  asset: "Index fund",
  category: "Stocks ISA UK",
  currency: "GBP",
  investedMinor: 10_000,
  currentValueMinor: null,
  frequency: "Monthly",
  scope: "personal",
};

describe("investment repository", () => {
  it("persists and reads valid entries while dropping malformed records", () => {
    let saved: string | null = null;
    const storage = {
      getItem: vi.fn(() => saved),
      setItem: vi.fn((_key: string, value: string) => {
        saved = value;
      }),
    } as unknown as Storage;
    const repository = createInvestmentRepository(storage);

    repository.save([sample]);
    saved = JSON.stringify([sample, { ...sample, investedMinor: -1 }]);

    expect(repository.list()).toEqual([sample]);
    expect(storage.getItem).toHaveBeenCalledWith(
      "finance-tracker.investments.v1",
    );
  });

  it("returns an empty list for corrupt local data", () => {
    const storage = {
      getItem: vi.fn(() => "not-json"),
      setItem: vi.fn(),
    } as unknown as Storage;
    expect(createInvestmentRepository(storage).list()).toEqual([]);
  });
});
