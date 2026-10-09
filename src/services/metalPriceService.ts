import type { Currency } from "../domain/money";
import type { BullionMetal, MetalPriceSnapshot } from "../domain/investment";

const CACHE_KEY = "finance-tracker.metal-prices.v1";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const GOLD_API_BASE = "https://api.gold-api.com/price";
const FX_API_BASE = "https://api.frankfurter.dev/v2/rate/usd";

type FetchLike = (
  input: string,
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface MetalPriceResult {
  snapshot: MetalPriceSnapshot;
  stale: boolean;
}

export interface MetalPriceService {
  load(): Promise<MetalPriceResult | null>;
}

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function isMetalPriceSnapshot(value: unknown): value is MetalPriceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MetalPriceSnapshot>;
  return (
    typeof snapshot.fetchedAt === "string" &&
    !Number.isNaN(Date.parse(snapshot.fetchedAt)) &&
    isPositiveNumber(snapshot.usdPerTroyOunce?.gold) &&
    isPositiveNumber(snapshot.usdPerTroyOunce?.silver) &&
    isPositiveNumber(snapshot.usdRates?.GBP) &&
    isPositiveNumber(snapshot.usdRates?.EUR) &&
    isPositiveNumber(snapshot.usdRates?.INR)
  );
}

async function fetchJson(fetcher: FetchLike, url: string): Promise<unknown> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error("Price request failed");
  return response.json();
}

async function fetchMetalPrice(
  fetcher: FetchLike,
  metal: BullionMetal,
): Promise<number> {
  const symbol = metal === "gold" ? "XAU" : "XAG";
  const response = (await fetchJson(fetcher, `${GOLD_API_BASE}/${symbol}`)) as {
    price?: unknown;
  };
  if (!isPositiveNumber(response.price))
    throw new Error("Invalid metal price response");
  return response.price;
}

async function fetchUsdRate(
  fetcher: FetchLike,
  currency: Currency,
): Promise<number> {
  const response = (await fetchJson(
    fetcher,
    `${FX_API_BASE}/${currency.toLowerCase()}`,
  )) as { rate?: unknown };
  if (!isPositiveNumber(response.rate))
    throw new Error("Invalid currency rate response");
  return response.rate;
}

export function createMetalPriceService(
  storage: Pick<Storage, "getItem" | "setItem">,
  fetcher: FetchLike,
  now: () => Date = () => new Date(),
): MetalPriceService {
  const readCache = (): MetalPriceSnapshot | null => {
    try {
      const stored = storage.getItem(CACHE_KEY);
      if (!stored) return null;
      const parsed: unknown = JSON.parse(stored);
      return isMetalPriceSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  return {
    async load() {
      const cached = readCache();
      const currentTime = now().getTime();
      if (
        cached &&
        currentTime - new Date(cached.fetchedAt).getTime() < CACHE_MAX_AGE_MS
      )
        return { snapshot: cached, stale: false };

      try {
        const [gold, silver, GBP, EUR, INR] = await Promise.all([
          fetchMetalPrice(fetcher, "gold"),
          fetchMetalPrice(fetcher, "silver"),
          fetchUsdRate(fetcher, "GBP"),
          fetchUsdRate(fetcher, "EUR"),
          fetchUsdRate(fetcher, "INR"),
        ]);
        const snapshot: MetalPriceSnapshot = {
          fetchedAt: now().toISOString(),
          usdPerTroyOunce: { gold, silver },
          usdRates: { GBP, EUR, INR },
        };
        try {
          storage.setItem(CACHE_KEY, JSON.stringify(snapshot));
        } catch {
          // A live result remains useful when browser storage is unavailable.
        }
        return { snapshot, stale: false };
      } catch {
        return cached ? { snapshot: cached, stale: true } : null;
      }
    },
  };
}

const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

export const metalPriceService = createMetalPriceService(
  browserStorage,
  (input) => fetch(input),
);
