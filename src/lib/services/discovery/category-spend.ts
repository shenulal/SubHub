// src/lib/services/discovery/category-spend.ts
/**
 * Category breakdown for the dashboard donut (parent → subcategory roll-up).
 * Aggregates ACTIVE subscriptions directly so the chart always has data in the
 * organisation base currency.
 */
import { prisma } from "@/lib/db";
import type { CategorySpendSlice, WorkspaceScope } from "@/types/discovery";

import { type BaseConverter } from "./base-currency";
import { roundMoney } from "./money";
import { discoveryWhere, type ViewerContext } from "./scope-where";

export interface CategorySpendParams {
  organizationId: string;
  scope: WorkspaceScope;
  viewer: ViewerContext;
  ownerId?: string;
  teamId?: string;
  converter: BaseConverter;
}

interface FlatSlice {
  categoryId: string | null;
  name: string;
  color: string | null;
  parentId: string | null;
  monthlyBase: number;
  count: number;
}

export const UNCATEGORISED_KEY = "__uncategorised";

/** Roll flat category rows up into parent slices with children. */
export function rollUpCategories(
  flat: FlatSlice[],
  parents: Array<{ id: string; name: string; color: string | null }>
): CategorySpendSlice[] {
  const parentIds = new Set(parents.map((p) => p.id));
  const byParent = new Map<string, FlatSlice[]>();
  const roots: CategorySpendSlice[] = [];

  for (const row of flat) {
    const parentKey =
      row.parentId && parentIds.has(row.parentId) ? row.parentId : null;
    if (parentKey) {
      byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), row]);
    } else {
      roots.push({ ...row, children: [] });
    }
  }

  const merged = roots.map((root) => {
    const kids = root.categoryId ? (byParent.get(root.categoryId) ?? []) : [];
    const children = kids.map((k) => ({ ...k }));
    return {
      ...root,
      monthlyBase:
        root.monthlyBase + children.reduce((s, c) => s + c.monthlyBase, 0),
      count: root.count + children.reduce((s, c) => s + c.count, 0),
      children,
    };
  });

  // Parents that only have children (no direct subscriptions) still need a slice.
  const orphanParents = parents
    .filter(
      (p) => byParent.has(p.id) && !merged.some((m) => m.categoryId === p.id)
    )
    .map((p) => {
      const children = (byParent.get(p.id) ?? []).map((k) => ({ ...k }));
      return {
        categoryId: p.id,
        name: p.name,
        color: p.color,
        parentId: null,
        monthlyBase: children.reduce((s, c) => s + c.monthlyBase, 0),
        count: children.reduce((s, c) => s + c.count, 0),
        children,
      };
    });

  return [...merged, ...orphanParents]
    .filter((s) => s.count > 0)
    .sort((a, b) => b.monthlyBase - a.monthlyBase);
}

async function aggregateLocally(
  params: CategorySpendParams
): Promise<CategorySpendSlice[]> {
  const { organizationId, scope, viewer, ownerId, teamId, converter } = params;
  const rows = await prisma.subscription.findMany({
    where: discoveryWhere(organizationId, scope, viewer, {
      status: "ACTIVE",
      ...(ownerId && { ownerId }),
      ...(teamId && { teamId }),
    }),
    select: {
      amount: true,
      currency: true,
      billingCycle: true,
      category: {
        select: { id: true, name: true, color: true, parentId: true },
      },
    },
  });

  const totals = new Map<string, FlatSlice>();
  for (const row of rows) {
    const key = row.category?.id ?? UNCATEGORISED_KEY;
    const monthly = await converter.monthlyBase(
      Number(row.amount),
      row.currency,
      row.billingCycle
    );
    const existing = totals.get(key) ?? {
      categoryId: row.category?.id ?? null,
      name: row.category?.name ?? UNCATEGORISED_KEY,
      color: row.category?.color ?? null,
      parentId: row.category?.parentId ?? null,
      monthlyBase: 0,
      count: 0,
    };
    totals.set(key, {
      ...existing,
      monthlyBase: existing.monthlyBase + monthly,
      count: existing.count + 1,
    });
  }

  const parents = await prisma.category.findMany({
    where: { organizationId, parentId: null, isArchived: false },
    select: { id: true, name: true, color: true },
  });
  return rollUpCategories(Array.from(totals.values()), parents);
}

/**
 * Category spend in base currency (FX-aware). The Taxonomy agent's
 * `getCategorySpend` currently treats currencies at parity, so the dashboard
 * aggregates here and converts through the Platform FX module instead.
 */
export async function getCategorySpendBreakdown(
  params: CategorySpendParams
): Promise<CategorySpendSlice[]> {
  return aggregateLocally(params);
}

export interface CategoryRow {
  parent: string;
  category: string;
  monthlyBase: number;
  annualBase: number;
  count: number;
}

const MONTHS_PER_YEAR = 12;

/** Flatten parent/child slices into CSV rows (parent row first, then children). */
export function flattenCategorySpend(
  slices: CategorySpendSlice[]
): CategoryRow[] {
  return slices.flatMap((parent) => {
    const self: CategoryRow = {
      parent: parent.name,
      category: "",
      monthlyBase: roundMoney(parent.monthlyBase),
      annualBase: roundMoney(parent.monthlyBase * MONTHS_PER_YEAR),
      count: parent.count,
    };
    const children = (parent.children ?? []).map((c) => ({
      parent: parent.name,
      category: c.name,
      monthlyBase: roundMoney(c.monthlyBase),
      annualBase: roundMoney(c.monthlyBase * MONTHS_PER_YEAR),
      count: c.count,
    }));
    return [self, ...children];
  });
}
