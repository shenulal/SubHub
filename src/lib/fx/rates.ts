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

async function findDirect(
  from: string,
  to: string,
  asOf?: Date
): Promise<RateRow | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: {
      baseCurrency: from,
      quoteCurrency: to,
      ...(asOf ? { asOf: { lte: asOf } } : {}),
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
