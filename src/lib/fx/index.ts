// src/lib/fx/index.ts
/**
 * FX helper — the only way feature code should convert or total money.
 *
 *   import { convertAmount, normalizeToBase, formatMoney } from "@/lib/fx";
 *
 * Pure helpers (`toMonthlyAmount`, `formatMoney`) live in `./convert` and are
 * safe for client components; everything else touches the database.
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import {
  currencyDecimals,
  DEFAULT_CYCLE_MONTHS,
  MONTHS_PER_YEAR,
  roundTo,
  toMonthlyAmount,
  type BillingCycle,
} from "./convert";
import { getRate, type RateLookupOptions, type RateResult } from "./rates";

export { getBaseCurrency, getCurrencyContext } from "./base-currency";
export {
  currencyDecimals,
  DEFAULT_CYCLE_MONTHS,
  formatMoney,
  MONTHS_PER_YEAR,
  roundTo,
  toMonthlyAmount,
  ZERO_DECIMAL_CURRENCIES,
  type BillingCycle,
} from "./convert";
export {
  getRate,
  PIVOT_CURRENCY,
  type RateLookupOptions,
  type RateResult,
} from "./rates";

export interface ConvertOptions extends RateLookupOptions {
  /** Rounding precision for the converted amount (default: target currency) */
  decimals?: number;
}

export interface ConvertResult {
  amount: number;
  rate: number;
  stale: boolean;
}

export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  opts: ConvertOptions = {}
): Promise<ConvertResult> {
  const { decimals, ...rateOpts } = opts;
  const { rate, stale } = await getRate(from, to, rateOpts);
  return {
    amount: roundTo(amount * rate, currencyDecimals(to, decimals)),
    rate,
    stale,
  };
}

/** Months per cycle from `BillingCycleConfig`, falling back to 1/3/12/0. */
export async function getBillingCycleMonths(
  organizationId: string
): Promise<Record<BillingCycle, number>> {
  const rows = await prisma.billingCycleConfig.findMany({
    where: { organizationId },
    select: { cycle: true, months: true },
  });
  const out: Record<BillingCycle, number> = { ...DEFAULT_CYCLE_MONTHS };
  for (const row of rows) {
    out[row.cycle as BillingCycle] = row.months;
  }
  return out;
}

export interface NormalizeItem {
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
}

export interface NormalizeResult {
  baseCurrency: string;
  monthlyTotal: number;
  annualTotal: number;
  stale: boolean;
  items: { monthlyBase: number; rate: number; stale: boolean }[];
}

/**
 * Convert a list of priced items into monthly amounts in the organisation's
 * base currency. Rates are looked up once per currency pair.
 */
export async function normalizeToBase(
  organizationId: string,
  items: NormalizeItem[]
): Promise<NormalizeResult> {
  const [settings, months] = await Promise.all([
    getSettings(organizationId, [
      "finance.baseCurrency",
      "finance.roundingDecimals",
      "finance.fxStaleAfterDays",
    ]),
    getBillingCycleMonths(organizationId),
  ]);
  const baseCurrency = settings["finance.baseCurrency"];
  const decimals = settings["finance.roundingDecimals"];
  const staleAfterDays = settings["finance.fxStaleAfterDays"];

  const rateCache = new Map<string, Promise<RateResult>>();
  const rateFor = (currency: string) => {
    const code = currency.toUpperCase();
    if (!rateCache.has(code)) {
      rateCache.set(code, getRate(code, baseCurrency, { staleAfterDays }));
    }
    return rateCache.get(code)!;
  };

  const resolved = await Promise.all(
    items.map(async (item) => {
      const { rate, stale } = await rateFor(item.currency);
      const monthly = toMonthlyAmount(
        item.amount,
        item.billingCycle,
        months[item.billingCycle]
      );
      return { monthlyBase: roundTo(monthly * rate, decimals), rate, stale };
    })
  );

  const monthlyTotal = roundTo(
    resolved.reduce((sum, r) => sum + r.monthlyBase, 0),
    decimals
  );
  return {
    baseCurrency,
    monthlyTotal,
    annualTotal: roundTo(monthlyTotal * MONTHS_PER_YEAR, decimals),
    stale: resolved.some((r) => r.stale),
    items: resolved,
  };
}
