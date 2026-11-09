// src/lib/services/platform-analytics/money.ts
/**
 * Spend conversion for Control Panel analytics. Reuses the tenant dashboard's
 * `BaseConverter` (same formula as the workspace KPI: amount → target currency
 * via `@/lib/fx`, then ÷ months per cycle from that organisation's
 * `BillingCycleConfig`). One converter per organisation, all targeting the same
 * currency: the platform base for the platform view, the organisation's base
 * for the organisation view. Rates come from the FX module's shared snapshot.
 */
import { currencyDecimals, roundTo } from "@/lib/fx/convert";
import {
  BaseConverter,
  type CycleMonths,
} from "@/lib/services/discovery/base-currency";
import type { BillingCycle } from "@prisma/client";

import type { CycleMonthsRow } from "./queries";

export interface MoneyRow {
  organizationId: string;
  currency: string;
  billingCycle: string;
  amount: number;
}

export class SpendConverter {
  private readonly converters = new Map<string, BaseConverter>();
  private readonly cycleMonths = new Map<string, CycleMonths>();

  constructor(
    public readonly currency: string,
    cycleRows: CycleMonthsRow[]
  ) {
    for (const row of cycleRows) {
      const months = this.cycleMonths.get(row.organizationId) ?? {};
      this.cycleMonths.set(row.organizationId, {
        ...months,
        [row.cycle]: row.months,
      });
    }
  }

  private forOrganization(organizationId: string): BaseConverter {
    const existing = this.converters.get(organizationId);
    if (existing) return existing;
    const converter = new BaseConverter(
      organizationId,
      this.currency,
      this.cycleMonths.get(organizationId) ?? {}
    );
    this.converters.set(organizationId, converter);
    return converter;
  }

  /** Monthly-equivalent amount of a (grouped) row in the target currency. */
  monthly(row: MoneyRow): Promise<number> {
    return this.forOrganization(row.organizationId).monthlyBase(
      Number(row.amount),
      row.currency,
      row.billingCycle as BillingCycle
    );
  }

  /** Convert every row once; results keep the input order. */
  monthlyAll<T extends MoneyRow>(
    rows: T[]
  ): Promise<Array<{ row: T; monthly: number }>> {
    return Promise.all(
      rows.map(async (row) => ({ row, monthly: await this.monthly(row) }))
    );
  }

  get hasStaleRates(): boolean {
    return [...this.converters.values()].some((c) => c.hasStaleRates);
  }

  round(value: number): number {
    return roundTo(value, currencyDecimals(this.currency));
  }
}
