export type Currency = "GBP" | "EUR" | "INR";

export const CURRENCIES: Currency[] = ["GBP", "EUR", "INR"];
export const isCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && CURRENCIES.includes(value as Currency);

export const toMinorUnits = (value: number): number => Math.round(value * 100);
export const fromMinorUnits = (value: number): number => value / 100;

export function formatMoney(value: number, currency: Currency): string {
  const locale = currency === "INR" ? "en-IN" : "en-GB";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinorUnits(value));
}
