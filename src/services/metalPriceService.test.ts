import { describe, expect, it, vi } from "vitest";
import { createMetalPriceService } from "./metalPriceService";

const response = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

describe("metal price service", () => {
  it("fetches and caches gold, silver and currency rates", async () => {
    let saved: string | null = null;
    const storage = {
      getItem: vi.fn(() => saved),
      setItem: vi.fn((_key: string, value: string) => {
        saved = value;
      }),
    };
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("XAU")) return response({ price: 3000 });
      if (url.endsWith("XAG")) return response({ price: 30 });
      if (url.endsWith("gbp")) return response({ rate: 0.75 });
      if (url.endsWith("eur")) return response({ rate: 0.9 });
      return response({ rate: 83 });
    });
    const service = createMetalPriceService(
      storage,
      fetcher,
      () => new Date("2026-10-09T08:00:00Z"),
    );

    const first = await service.load();
    const second = await service.load();

    expect(first).toEqual({
      snapshot: {
        fetchedAt: "2026-10-09T08:00:00.000Z",
        usdPerTroyOunce: { gold: 3000, silver: 30 },
        usdRates: { GBP: 0.75, EUR: 0.9, INR: 83 },
      },
      stale: false,
    });
    expect(second).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("falls back to an expired cached price when refresh fails", async () => {
    const cached = {
      fetchedAt: "2026-10-07T08:00:00.000Z",
      usdPerTroyOunce: { gold: 2900, silver: 29 },
      usdRates: { GBP: 0.74, EUR: 0.89, INR: 82 },
    };
    const service = createMetalPriceService(
      {
        getItem: () => JSON.stringify(cached),
        setItem: vi.fn(),
      },
      vi.fn(async () => {
        throw new Error("offline");
      }),
      () => new Date("2026-10-09T08:00:00Z"),
    );

    await expect(service.load()).resolves.toEqual({
      snapshot: cached,
      stale: true,
    });
  });
});
