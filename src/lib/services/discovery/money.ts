// src/lib/services/discovery/money.ts
/**
 * Client-safe money helpers for the discovery area. Formatting and cycle
 * normalisation come from the Platform FX module's pure layer
 * (`@/lib/fx/convert`, no server imports); this file only adds thin wrappers.
 */
import {
  DEFAULT_CYCLE_MONTHS,
  formatMoney,
  MONTHS_PER_YEAR,
  toMonthlyAmount,
  type BillingCycle as FxBillingCycle,
} from "@/lib/fx/convert";
import type { BillingCycle } from "@prisma/client";

export { DEFAULT_CYCLE_MONTHS, formatMoney, MONTHS_PER_YEAR, toMonthlyAmount };

export type CycleMonths = Partial<Record<BillingCycle, number>>;

export function monthsForCycle(
  cycle: BillingCycle,
  cycleMonths?: CycleMonths
): number {
  return cycleMonths?.[cycle] ?? DEFAULT_CYCLE_MONTHS[cycle as FxBillingCycle];
}

export function toAnnualAmount(
  amount: number,
  cycle: BillingCycle,
  cycleMonths?: CycleMonths
): number {
  return (
    toMonthlyAmount(
      amount,
      cycle as FxBillingCycle,
      monthsForCycle(cycle, cycleMonths)
    ) * MONTHS_PER_YEAR
  );
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Compact "1.2K" style for KPI tiles; falls back to standard formatting. */
export function formatMoneyCompact(
  amount: number,
  currency: string,
  locale = "en"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return formatMoney(amount, currency, locale);
  }
}
