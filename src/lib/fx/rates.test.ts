import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRate, invalidateRateCache, resetMissingRateLog } from "./rates";

vi.mock("@/lib/db", () => ({
  prisma: { exchangeRate: { findFirst: vi.fn() }, $queryRaw: vi.fn() },
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const findFirst = prisma.exchangeRate.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;
const NOW = new Date("2026-11-04T10:00:00Z");
const FRESH = new Date("2026-11-03T00:00:00Z");
const OLD = new Date("2026-10-01T00:00:00Z");

type Row = {
  base: string;
  quote: string;
  rate: number;
  asOf: Date;
  source?: string;
};

function stubRows(rows: Row[]) {
  // Snapshot path (current rates): one query returning the latest row per pair.
  queryRaw.mockResolvedValue(
    rows.map((r) => ({
      baseCurrency: r.base,
      quoteCurrency: r.quote,
      rate: r.rate,
      asOf: r.asOf,
      source: r.source ?? "api",
    }))
  );
  // Historical path (asOf set): direct table query.
  findFirst.mockImplementation(
    async (args: {
      where: { baseCurrency: string; quoteCurrency: string };
    }) => {
      const hit = rows.find(
        (r) =>
          r.base === args.where.baseCurrency &&
          r.quote === args.where.quoteCurrency
      );
      return hit
        ? { rate: hit.rate, asOf: hit.asOf, source: hit.source ?? "api" }
        : null;
    }
  );
}

describe("getRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMissingRateLog();
    invalidateRateCache();
  });

  it("returns 1 for the same currency without hitting the database", async () => {
    const result = await getRate("aed", "AED", { now: NOW });
    expect(result).toMatchObject({ rate: 1, stale: false, source: "identity" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("uses the direct pair when present", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 3.6725, asOf: FRESH }]);
    const result = await getRate("USD", "AED", { now: NOW });
    expect(result).toEqual({
      rate: 3.6725,
      asOf: FRESH,
      stale: false,
      source: "api",
    });
  });

  it("inverts the reverse pair when the direct one is missing", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 4, asOf: FRESH }]);
    const result = await getRate("AED", "USD", { now: NOW });
    expect(result.rate).toBeCloseTo(0.25, 10);
    expect(result.source).toBe("inverted");
  });

  it("triangulates through USD and reports the older leg date", async () => {
    stubRows([
      { base: "USD", quote: "AED", rate: 3.6725, asOf: FRESH },
      { base: "USD", quote: "SAR", rate: 3.75, asOf: OLD },
    ]);
    const result = await getRate("AED", "SAR", { now: NOW });
    expect(result.rate).toBeCloseTo(3.75 / 3.6725, 10);
    expect(result.source).toBe("triangulated");
    expect(result.asOf).toEqual(OLD);
    expect(result.stale).toBe(true);
  });

  it("flags rates older than staleAfterDays", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 3.67, asOf: OLD }]);
    expect((await getRate("USD", "AED", { now: NOW })).stale).toBe(true);
    expect(
      (await getRate("USD", "AED", { now: NOW, staleAfterDays: 90 })).stale
    ).toBe(false);
  });

  it("returns rate 1 / stale / source none and logs once when nothing exists", async () => {
    stubRows([]);
    const first = await getRate("GBP", "SAR", { now: NOW });
    const second = await getRate("GBP", "SAR", { now: NOW });
    expect(first).toEqual({ rate: 1, asOf: null, stale: true, source: "none" });
    expect(second.source).toBe("none");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("loads the latest-rate snapshot once for many current-rate lookups", async () => {
    stubRows([
      { base: "USD", quote: "AED", rate: 3.6725, asOf: FRESH },
      { base: "USD", quote: "SAR", rate: 3.75, asOf: FRESH },
      { base: "USD", quote: "EUR", rate: 0.92, asOf: FRESH },
    ]);
    await Promise.all(
      ["SAR", "EUR", "USD", "SAR", "EUR"].map((c) =>
        getRate("AED", c, { now: NOW })
      )
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("reloads the snapshot after invalidateRateCache()", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 3.6725, asOf: FRESH }]);
    await getRate("USD", "AED", { now: NOW });
    stubRows([{ base: "USD", quote: "AED", rate: 3.7, asOf: NOW }]);
    expect((await getRate("USD", "AED", { now: NOW })).rate).toBe(3.6725);
    invalidateRateCache();
    expect((await getRate("USD", "AED", { now: NOW })).rate).toBe(3.7);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed snapshot load", async () => {
    queryRaw.mockRejectedValueOnce(new Error("db down"));
    await expect(getRate("USD", "AED", { now: NOW })).rejects.toThrow(
      "db down"
    );
    stubRows([{ base: "USD", quote: "AED", rate: 3.6725, asOf: FRESH }]);
    expect((await getRate("USD", "AED", { now: NOW })).rate).toBe(3.6725);
  });

  it("skips non-positive rates in the snapshot", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 0, asOf: FRESH }]);
    expect((await getRate("USD", "AED", { now: NOW })).source).toBe("none");
  });

  it("passes the asOf bound to the query", async () => {
    stubRows([{ base: "USD", quote: "AED", rate: 3.67, asOf: FRESH }]);
    const asOf = new Date("2026-11-01T00:00:00Z");
    await getRate("USD", "AED", { asOf, now: NOW });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ asOf: { lte: asOf } }),
      })
    );
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
