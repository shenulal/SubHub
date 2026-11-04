// src/lib/services/subscription/money-adapter.ts
/**
 * Thin adapter over the platform FX module (`@/lib/fx`, owned by the platform
 * agent). Keeping the import here lets subscription services and their tests
 * depend on a single, mockable surface.
 */
import type { BillingCycle } from "@prisma/client";

// Dynamic imports keep this adapter loadable while `@/lib/fx` is being written.
async function fx() {
  return import("@/lib/fx");
}
async function baseCurrencyModule() {
  return import("@/lib/fx/base-currency");
}

export interface MonthlyBaseInput {
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
}

/**
 * Monthly-normalised amount in the organisation base currency.
 * Returns null when FX data is unavailable so callers can fall back to raw amounts.
 */
export async function toMonthlyBaseAmount(
  organizationId: string,
  input: MonthlyBaseInput
): Promise<number | null> {
  try {
    const { getBaseCurrency } = await baseCurrencyModule();
    const { convertAmount, getBillingCycleMonths, toMonthlyAmount } =
      await fx();
    const base = await getBaseCurrency(organizationId);
    const months = await getBillingCycleMonths(organizationId);
    const monthly = toMonthlyAmount(
      input.amount,
      input.billingCycle,
      months[input.billingCycle]
    );
    if (input.currency === base) return monthly;
    const converted = await convertAmount(monthly, input.currency, base);
    return Number.isFinite(converted.amount) ? converted.amount : null;
  } catch {
    return null;
  }
}

export async function resolveBaseCurrency(
  organizationId: string
): Promise<string | null> {
  try {
    const { getBaseCurrency } = await baseCurrencyModule();
    return await getBaseCurrency(organizationId);
  } catch {
    return null;
  }
}
