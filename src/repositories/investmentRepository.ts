import { isValidInvestmentEntry } from "../domain/investment";
import type { InvestmentEntry } from "../domain/investment";

const STORAGE_KEY = "finance-tracker.investments.v1";

export interface InvestmentRepository {
  list(): InvestmentEntry[];
  save(entries: InvestmentEntry[]): void;
}

export function createInvestmentRepository(
  storage: Storage,
): InvestmentRepository {
  return {
    list() {
      try {
        const saved = storage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed: unknown = JSON.parse(saved);
        return Array.isArray(parsed)
          ? parsed.filter(isValidInvestmentEntry)
          : [];
      } catch {
        return [];
      }
    },
    save(entries) {
      storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    },
  };
}

const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
} as Storage;

export const localInvestmentRepository =
  createInvestmentRepository(browserStorage);
