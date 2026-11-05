// src/lib/fx/rates.ts
/**
 * Exchange-rate lookup against the `exchange_rates` table.
 *
 * Resolution order for `from → to`:
 *   1. same currency → 1
 *   2. direct row (base=from, quote=to)
 *   3. inverted row (base=to, quote=from) → 1 / rate
 *   4. triangulation through the pivot currency (from → USD → to)
 *   5. nothing found → rate 1, stale, source "none" (logged once per pair)
 *
 * Current-rate lookups (no `asOf`) read an in-memory snapshot of the latest
 * row per pair, loaded with ONE query and shared by every caller for a short
 * TTL. Before this, each conversion issued up to six queries, so a page that
 * listed 40 currencies ran ~240 queries. Historical lookups (`asOf` set) still
 * query the table directly. Writers call `invalidateRateCache()`.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { SETTING_DEFINITIONS } from "@/lib/settings/registry";

/** Pivot used for triangulation; providers always fetch with this base. */
export const PIVOT_CURRENCY = "USD";
const MS_PER_DAY = 86_400_000;
const DEFAULT_STALE_AFTER_DAYS = SETTING_DEFINITIONS["finance.fxStaleAfterDays"]
  .defaultValue as number;

export interface RateLookupOptions {
  /** Use the latest rate observed on or before this date */
  asOf?: Date;
  /** Rates older than this are flagged `stale` (default: registry default) */
  staleAfterDays?: number;
  /** Reference "now" for staleness (tests) */
  now?: Date;
}

export interface RateResult {
  rate: number;
  asOf: Date | null;
  stale: boolean;
  source: string;
}

interface RateRow {
  rate: number;
  asOf: Date;
  source: string;
}

const missingPairsLogged = new Set<string>();

/** How long the latest-rate snapshot is reused before it is reloaded. */
const RATE_SNAPSHOT_TTL_MS = 60_000;

type RateSnapshot = Map<string, RateRow>;
let snapshot: { loadedAt: number; rows: Promise<RateSnapshot> } | null = null;

const pairKey = (from: string, to: string) => `${from}:${to}`;

interface LatestRateRecord {
  baseCurrency: string;
  quoteCurrency: string;
  rate: unknown;
  asOf: Date;
  source: string;
}

async function loadSnapshot(): Promise<RateSnapshot> {
  const rows = await prisma.$queryRaw<LatestRateRecord[]>`
    SELECT DISTINCT ON (base_currency, quote_currency)
           base_currency  AS "baseCurrency",
           quote_currency AS "quoteCurrency",
           rate,
           as_of          AS "asOf",
           source
      FROM exchange_rates
     ORDER BY base_currency, quote_currency, as_of DESC`;
  const map: RateSnapshot = new Map();
  for (const row of rows) {
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    map.set(pairKey(row.baseCurrency, row.quoteCurrency), {
      rate,
      asOf: new Date(row.asOf),
      source: row.source,
    });
  }
  return map;
}

function latestRates(): Promise<RateSnapshot> {
  const now = Date.now();
  if (!snapshot || now - snapshot.loadedAt > RATE_SNAPSHOT_TTL_MS) {
    const rows = loadSnapshot();
    snapshot = { loadedAt: now, rows };
    // A failed load must not be cached; the next call retries.
    rows.catch(() => {
      if (snapshot?.rows === rows) snapshot = null;
    });
  }
  return snapshot.rows;
}

/** Drop the cached snapshot. Call after inserting or updating rates. */
export function invalidateRateCache(): void {
  snapshot = null;
}

async function findDirect(
  from: string,
  to: string,
  asOf?: Date
): Promise<RateRow | null> {
  if (!asOf) {
    return (await latestRates()).get(pairKey(from, to)) ?? null;
  }
  const row = await prisma.exchangeRate.findFirst({
    where: {
      baseCurrency: from,
      quoteCurrency: to,
      asOf: { lte: asOf },
    },
    orderBy: { asOf: "desc" },
    select: { rate: true, asOf: true, source: true },
  });
  if (!row) return null;
  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return { rate, asOf: row.asOf, source: row.source };
}

async function findDirectOrInverted(
  from: string,
  to: string,
  asOf?: Date
): Promise<RateRow | null> {
  const direct = await findDirect(from, to, asOf);
  if (direct) return direct;
  const inverted = await findDirect(to, from, asOf);
  if (!inverted) return null;
  return { ...inverted, rate: 1 / inverted.rate, source: "inverted" };
}

function isStale(asOf: Date, staleAfterDays: number, now: Date): boolean {
  return now.getTime() - asOf.getTime() > staleAfterDays * MS_PER_DAY;
}

function olderOf(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export async function getRate(
  from: string,
  to: string,
  opts: RateLookupOptions = {}
): Promise<RateResult> {
  const base = from.toUpperCase();
  const quote = to.toUpperCase();
  const now = opts.now ?? new Date();
  const staleAfterDays = opts.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  if (base === quote) {
    return { rate: 1, asOf: now, stale: false, source: "identity" };
  }

  const pair = await findDirectOrInverted(base, quote, opts.asOf);
  if (pair) {
    return {
      rate: pair.rate,
      asOf: pair.asOf,
      stale: isStale(pair.asOf, staleAfterDays, now),
      source: pair.source,
    };
  }

  if (base !== PIVOT_CURRENCY && quote !== PIVOT_CURRENCY) {
    const [leg1, leg2] = await Promise.all([
      findDirectOrInverted(base, PIVOT_CURRENCY, opts.asOf),
      findDirectOrInverted(PIVOT_CURRENCY, quote, opts.asOf),
    ]);
    if (leg1 && leg2) {
      const asOf = olderOf(leg1.asOf, leg2.asOf);
      return {
        rate: leg1.rate * leg2.rate,
        asOf,
        stale: isStale(asOf, staleAfterDays, now),
        source: "triangulated",
      };
    }
  }

  const key = `${base}->${quote}`;
  if (!missingPairsLogged.has(key)) {
    missingPairsLogged.add(key);
    logger.warn({ from: base, to: quote }, "[fx] no exchange rate available");
  }
  return { rate: 1, asOf: null, stale: true, source: "none" };
}

/** Test hook: forget which pairs have already been logged. */
export function resetMissingRateLog(): void {
  missingPairsLogged.clear();
}
