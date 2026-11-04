// src/actions/taxonomy/category-spend.ts
/**
 * Analytics hook: monthly-normalised spend per category in the organisation's
 * base currency. Cycle lengths come from `BillingCycleConfig`.
 */
"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import {
  bucketSpendByCategory,
  roundMoney,
  type CycleMonthsMap,
} from "@/lib/services/taxonomy/spend-normalizer";
import { getSetting } from "@/lib/settings/service";
import type { CategorySpendRow } from "@/types/taxonomy";

import { toActionError } from "./_shared";

const UNCATEGORISED_KEY = "__uncategorised__";
const COUNTED_STATUSES = ["ACTIVE", "PENDING", "PAUSED"] as const;

export interface CategorySpendFilter {
  ownerId?: string;
  teamId?: string;
}

// TODO(fx): replace with `convertAmount(amount, currency, baseCurrency)` from `@/lib/fx`
// once the finance area ships it. Until then every currency is treated at parity.
const FLAT_RATE = 1;
function rateToBase(): number {
  return FLAT_RATE;
}

export async function getCategorySpend(
  filter: CategorySpendFilter = {}
): Promise<CategorySpendRow[]> {
  try {
    const { organizationId } = await requirePermission([
      "categories:read",
      "subscriptions:read",
    ]);
    const [baseCurrency, cycles, subscriptions, categories] = await Promise.all(
      [
        getSetting(organizationId, "finance.baseCurrency"),
        prisma.billingCycleConfig.findMany({
          where: { organizationId },
          select: { cycle: true, months: true },
        }),
        prisma.subscription.findMany({
          where: {
            organizationId,
            status: { in: [...COUNTED_STATUSES] },
            archivedAt: null,
            ...(filter.ownerId && { ownerId: filter.ownerId }),
            ...(filter.teamId && { teamId: filter.teamId }),
          },
          select: {
            categoryId: true,
            amount: true,
            billingCycle: true,
            currency: true,
          },
        }),
        prisma.category.findMany({
          where: { organizationId },
          select: { id: true, name: true, parent: { select: { name: true } } },
        }),
      ]
    );

    const cycleMonths: CycleMonthsMap = Object.fromEntries(
      cycles.map((c) => [c.cycle, c.months])
    );
    const buckets = bucketSpendByCategory(
      subscriptions.map((s) => ({
        categoryId: s.categoryId,
        amount: Number(s.amount),
        billingCycle: s.billingCycle,
        currency: s.currency,
      })),
      cycleMonths,
      () => rateToBase(),
      UNCATEGORISED_KEY
    );
    const byId = new Map(categories.map((c) => [c.id, c]));
    return buckets.map((b) => {
      const cat = byId.get(b.categoryId);
      return {
        categoryId: b.categoryId,
        name: cat?.name ?? "Uncategorised",
        parentName: cat?.parent?.name ?? null,
        monthlyTotal: roundMoney(b.monthlyTotal),
        currency: baseCurrency,
        count: b.count,
      };
    });
  } catch (error) {
    toActionError(error, "getCategorySpend");
    return [];
  }
}
