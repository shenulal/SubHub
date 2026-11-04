// src/lib/fx/convert.ts
/**
 * Pure currency helpers (no I/O). Safe to import from client components.
 */

import { SETTING_DEFINITIONS } from "@/lib/settings/registry";

export type BillingCycle = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";

/** Registry default for `finance.baseCurrency` (fallback when no org context). */
export const DEFAULT_BASE_CURRENCY: string =
  SETTING_DEFINITIONS["finance.baseCurrency"].defaultValue;

/** Months per billing cycle when the organisation has no BillingCycleConfig. */
export const DEFAULT_CYCLE_MONTHS: Readonly<Record<BillingCycle, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
  ONE_TIME: 0,
};

export const MONTHS_PER_YEAR = 12;

/** ISO 4217 currencies with no minor unit in everyday display. */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "KRW",
  "JPY",
  "IDR",
  "VND",
  "CLP",
  "ISK",
  "PYG",
  "UGX",
  "RWF",
  "XAF",
  "XOF",
]);

const DEFAULT_DECIMALS = 2;
const ZERO_DECIMALS = 0;
export const DEFAULT_LOCALE = "en";

/** Minor-unit digits for a currency, honouring an explicit override. */
export function currencyDecimals(currency: string, override?: number): number {
  if (typeof override === "number" && Number.isFinite(override)) {
    return Math.max(0, Math.trunc(override));
  }
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())
    ? ZERO_DECIMALS
    : DEFAULT_DECIMALS;
}

/** Round half away from zero to `decimals` places without float drift. */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const places = Math.max(0, Math.trunc(decimals));
  const magnitude = Math.abs(value);
  const plain = String(magnitude);
  const rounded = plain.includes("e")
    ? Math.round(magnitude * 10 ** places) / 10 ** places
    : Number(`${Math.round(Number(`${plain}e${places}`))}e-${places}`);
  return value < 0 ? -rounded : rounded;
}

/**
 * Normalise an amount billed per `billingCycle` to a monthly figure.
 * ONE_TIME (or any cycle with 0 months) contributes nothing to recurring totals.
 */
export function toMonthlyAmount(
  amount: number,
  billingCycle: BillingCycle,
  monthsPerCycle?: number
): number {
  const months = monthsPerCycle ?? DEFAULT_CYCLE_MONTHS[billingCycle] ?? 0;
  if (!Number.isFinite(amount) || months <= 0) return 0;
  return amount / months;
}

/**
 * Format money with Intl using the currency's minor-unit semantics.
 * Falls back to a plain "<amount> <CODE>" string for unknown codes.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE,
  decimals?: number
): string {
  const code = currency.toUpperCase();
  const digits = currencyDecimals(code, decimals);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(safeAmount);
  } catch {
    return `${safeAmount.toFixed(digits)} ${code}`;
  }
}
