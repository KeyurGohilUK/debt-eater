import { CURRENCIES, isCurrency, type Currency } from "./money";

export type InvestmentScope = "personal" | "business";
export type BullionMetal = "gold" | "silver";
export type BullionHoldingType = "physical" | "digital";
export type BullionWeightUnit = "g" | "toz";

export interface BullionHolding {
  metal: BullionMetal;
  holdingType: BullionHoldingType;
  quantity: number;
  weightPerItem: number;
  weightUnit: BullionWeightUnit;
  purity: number;
}

export interface MetalPriceSnapshot {
  fetchedAt: string;
  usdPerTroyOunce: Record<BullionMetal, number>;
  usdRates: Record<Currency, number>;
}

export interface InvestmentEntry {
  id: string;
  date: string;
  provider: string;
  asset: string;
  category: string;
  currency: Currency;
  investedMinor: number;
  taxMinor?: number;
  currentValueMinor: number | null;
  frequency: string;
  scope: InvestmentScope;
  bullion?: BullionHolding;
}

export interface CurrencyInvestmentSummary {
  currency: Currency;
  entryCount: number;
  investedMinor: number;
  valuedEntryCount: number;
  currentValueMinor: number;
  gainMinor: number;
  gainPercent: number;
  taxMinor: number;
}

export function summarizeInvestments(
  entries: readonly InvestmentEntry[],
  valuesById: ReadonlyMap<string, number> = new Map(),
): CurrencyInvestmentSummary[] {
  const currencies = CURRENCIES.filter((currency) =>
    entries.some((entry) => entry.currency === currency),
  );

  return currencies.map((currency) => {
    const matching = entries.filter((entry) => entry.currency === currency);
    const valueFor = (entry: InvestmentEntry) =>
      valuesById.get(entry.id) ?? entry.currentValueMinor;
    const valued = matching.filter((entry) => valueFor(entry) !== null);
    const valuedInvestedMinor = valued.reduce(
      (sum, entry) => sum + entry.investedMinor,
      0,
    );
    const currentValueMinor = valued.reduce(
      (sum, entry) => sum + (valueFor(entry) ?? 0),
      0,
    );
    const gainMinor = currentValueMinor - valuedInvestedMinor;
    return {
      currency,
      entryCount: matching.length,
      investedMinor: matching.reduce(
        (sum, entry) => sum + entry.investedMinor,
        0,
      ),
      valuedEntryCount: valued.length,
      currentValueMinor,
      gainMinor,
      gainPercent:
        valuedInvestedMinor === 0 ? 0 : (gainMinor / valuedInvestedMinor) * 100,
      taxMinor: matching.reduce((sum, entry) => sum + (entry.taxMinor ?? 0), 0),
    };
  });
}

const GRAMS_PER_TROY_OUNCE = 31.1034768;

export interface BullionQuantitySummary {
  goldGrams: number;
  silverGrams: number;
}

export function summarizeBullionQuantities(
  entries: readonly InvestmentEntry[],
): BullionQuantitySummary {
  return entries.reduce(
    (summary, entry) => {
      if (!entry.bullion) return summary;
      const gramsPerItem =
        entry.bullion.weightUnit === "toz"
          ? entry.bullion.weightPerItem * GRAMS_PER_TROY_OUNCE
          : entry.bullion.weightPerItem;
      const totalGrams = entry.bullion.quantity * gramsPerItem;
      if (entry.bullion.metal === "gold") summary.goldGrams += totalGrams;
      else summary.silverGrams += totalGrams;
      return summary;
    },
    { goldGrams: 0, silverGrams: 0 },
  );
}

export function bullionValueMinor(
  holding: BullionHolding,
  currency: Currency,
  prices: MetalPriceSnapshot,
): number {
  const gramsPerItem =
    holding.weightUnit === "toz"
      ? holding.weightPerItem * GRAMS_PER_TROY_OUNCE
      : holding.weightPerItem;
  const fineTroyOunces =
    (holding.quantity * gramsPerItem * (holding.purity / 1000)) /
    GRAMS_PER_TROY_OUNCE;
  return Math.round(
    fineTroyOunces *
      prices.usdPerTroyOunce[holding.metal] *
      prices.usdRates[currency] *
      100,
  );
}

export function resolveInvestmentValues(
  entries: readonly InvestmentEntry[],
  prices: MetalPriceSnapshot | null,
): ReadonlyMap<string, number> {
  const values = new Map<string, number>();
  if (!prices) return values;
  entries.forEach((entry) => {
    if (entry.bullion)
      values.set(
        entry.id,
        bullionValueMinor(entry.bullion, entry.currency, prices),
      );
  });
  return values;
}

function isValidBullionHolding(value: unknown): value is BullionHolding {
  if (!value || typeof value !== "object") return false;
  const holding = value as Partial<BullionHolding>;
  return (
    (holding.metal === "gold" || holding.metal === "silver") &&
    (holding.holdingType === "physical" || holding.holdingType === "digital") &&
    typeof holding.quantity === "number" &&
    Number.isFinite(holding.quantity) &&
    holding.quantity > 0 &&
    typeof holding.weightPerItem === "number" &&
    Number.isFinite(holding.weightPerItem) &&
    holding.weightPerItem > 0 &&
    (holding.weightUnit === "g" || holding.weightUnit === "toz") &&
    typeof holding.purity === "number" &&
    Number.isFinite(holding.purity) &&
    holding.purity > 0 &&
    holding.purity <= 1000
  );
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
    (entry.taxMinor === undefined ||
      (Number.isSafeInteger(entry.taxMinor) && entry.taxMinor >= 0)) &&
    (entry.currentValueMinor === null ||
      (Number.isSafeInteger(entry.currentValueMinor) &&
        (entry.currentValueMinor ?? -1) >= 0)) &&
    typeof entry.frequency === "string" &&
    (entry.scope === "personal" || entry.scope === "business") &&
    (entry.bullion === undefined || isValidBullionHolding(entry.bullion))
  );
}
