import { CURRENCIES, isCurrency, type Currency } from "./money";

export type InvestmentScope = "personal" | "business";

export interface InvestmentEntry {
  id: string;
  date: string;
  provider: string;
  asset: string;
  category: string;
  currency: Currency;
  investedMinor: number;
  currentValueMinor: number | null;
  frequency: string;
  scope: InvestmentScope;
}

export interface CurrencyInvestmentSummary {
  currency: Currency;
  entryCount: number;
  investedMinor: number;
  valuedEntryCount: number;
  currentValueMinor: number;
  gainMinor: number;
}

export function summarizeInvestments(
  entries: readonly InvestmentEntry[],
): CurrencyInvestmentSummary[] {
  const currencies = CURRENCIES.filter((currency) =>
    entries.some((entry) => entry.currency === currency),
  );

  return currencies.map((currency) => {
    const matching = entries.filter((entry) => entry.currency === currency);
    const valued = matching.filter((entry) => entry.currentValueMinor !== null);
    return {
      currency,
      entryCount: matching.length,
      investedMinor: matching.reduce(
        (sum, entry) => sum + entry.investedMinor,
        0,
      ),
      valuedEntryCount: valued.length,
      currentValueMinor: valued.reduce(
        (sum, entry) => sum + (entry.currentValueMinor ?? 0),
        0,
      ),
      gainMinor: valued.reduce(
        (sum, entry) =>
          sum + (entry.currentValueMinor ?? 0) - entry.investedMinor,
        0,
      ),
    };
  });
}

export function isValidInvestmentEntry(
  value: unknown,
): value is InvestmentEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<InvestmentEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.date === "string" &&
    !Number.isNaN(Date.parse(entry.date)) &&
    typeof entry.provider === "string" &&
    typeof entry.asset === "string" &&
    typeof entry.category === "string" &&
    isCurrency(entry.currency) &&
    Number.isSafeInteger(entry.investedMinor) &&
    (entry.investedMinor ?? -1) > 0 &&
    (entry.currentValueMinor === null ||
      (Number.isSafeInteger(entry.currentValueMinor) &&
        (entry.currentValueMinor ?? -1) >= 0)) &&
    typeof entry.frequency === "string" &&
    (entry.scope === "personal" || entry.scope === "business")
  );
}
