// src/lib/services/discovery/base-currency.ts
/**
 * Server-side base-currency converter built on the Platform FX module
 * (`@/lib/fx`). Rates are resolved once per source currency and reused for
 * every row of a list/pipeline/dashboard request; `hasStaleRates` surfaces the
 * "rates may be out of date" hint in the UI.
 */
import {
  convertAmount,
  getBaseCurrency,
  getBillingCycleMonths,
  toMonthlyAmount,
  type BillingCycle as FxBillingCycle,
} from "@/lib/fx";
import { logger } from "@/lib/logger";
import type { BillingCycle } from "@prisma/client";

export type CycleMonths = Partial<Record<BillingCycle, number>>;

interface UnitRate {
  rate: number;
  stale: boolean;
}

export class BaseConverter {
  private readonly rates = new Map<string, Promise<UnitRate>>();
  public hasStaleRates = false;

  constructor(
    public readonly organizationId: string,
    public readonly baseCurrency: string,
    private readonly cycleMonths: CycleMonths
  ) {}

  private rateFor(currency: string): Promise<UnitRate> {
    const code = currency.toUpperCase();
    const cached = this.rates.get(code);
    if (cached) return cached;
    const promise = this.loadRate(code);
    this.rates.set(code, promise);
    return promise;
  }

  private async loadRate(code: string): Promise<UnitRate> {
    if (code === this.baseCurrency.toUpperCase()) {
      return { rate: 1, stale: false };
    }
    try {
      const result = await convertAmount(1, code, this.baseCurrency, {
        decimals: 8,
      });
      return { rate: result.rate, stale: result.stale };
    } catch (error) {
      logger.warn(
        { err: error, currency: code },
        "[discovery] FX rate unavailable, using parity"
      );
      return { rate: 1, stale: true };
    }
  }

  /** Amount converted to base currency (unrounded). */
  async toBase(amount: number, currency: string): Promise<number> {
    const { rate, stale } = await this.rateFor(currency);
    if (stale) this.hasStaleRates = true;
    return amount * rate;
  }

  /** Monthly-normalised amount in base currency. */
  async monthlyBase(
    amount: number,
    currency: string,
    cycle: BillingCycle
  ): Promise<number> {
    const base = await this.toBase(amount, currency);
    return toMonthlyAmount(
      base,
      cycle as FxBillingCycle,
      this.cycleMonths[cycle]
    );
  }

  monthsFor(cycle: BillingCycle): number | undefined {
    return this.cycleMonths[cycle];
  }
}

export async function resolveBaseCurrency(
  organizationId: string
): Promise<string> {
  return getBaseCurrency(organizationId);
}

export async function loadCycleMonths(
  organizationId: string
): Promise<CycleMonths> {
  try {
    return await getBillingCycleMonths(organizationId);
  } catch (error) {
    logger.warn({ err: error }, "[discovery] billing cycle config unavailable");
    return {};
  }
}

export async function createBaseConverter(
  organizationId: string
): Promise<BaseConverter> {
  const [baseCurrency, cycleMonths] = await Promise.all([
    resolveBaseCurrency(organizationId),
    loadCycleMonths(organizationId),
  ]);
  return new BaseConverter(organizationId, baseCurrency, cycleMonths);
}
