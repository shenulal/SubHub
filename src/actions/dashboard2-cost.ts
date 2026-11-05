// src/actions/dashboard2-cost.ts
// @deprecated Dashboard2-only cost actions. For reports use @/actions/reports/cost-analytics.
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { SpendByCategory, TopSpendingApp } from "@/types/dashboard2";
import { SubscriptionStatus } from "@prisma/client";

import {
  DEFAULT_BUDGET_SETTINGS,
  type BudgetSettings,
} from "./dashboard2-cost.constants";

/**
 * Get spend by category (including month-over-month change)
 * The change rate is estimated from subscriptions started last month vs this month
 */
export async function getSpendByCategory(): Promise<SpendByCategory[]> {
  const { organizationId } = await requireOrganization();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch currently active subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: SubscriptionStatus.ACTIVE,
    },
    include: { app: { select: { category: true } } },
  });

  // Current-month totals and subscription counts per category
  const categoryTotals = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  for (const sub of subscriptions) {
    const category = sub.app.category || "Other";
    const current = categoryTotals.get(category) || 0;
    categoryTotals.set(category, current + Number(sub.amount || 0));
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }

  // Estimate last month's totals per category
  // Include only subscriptions started before last month (exclude ones started this month)
  const previousCategoryTotals = new Map<string, number>();
  for (const sub of subscriptions) {
    const startDate = sub.startDate ? new Date(sub.startDate) : null;
    // Include only subscriptions started before last month
    if (startDate && startDate < currentMonthStart) {
      const category = sub.app.category || "Other";
      const current = previousCategoryTotals.get(category) || 0;
      previousCategoryTotals.set(category, current + Number(sub.amount || 0));
    }
  }

  const totalAmount = Array.from(categoryTotals.values()).reduce(
    (a, b) => a + b,
    0
  );

  const result: SpendByCategory[] = Array.from(categoryTotals.entries())
    .map(([category, amount]) => {
      const previousAmount = previousCategoryTotals.get(category) || 0;
      // Change rate: ((current - previous) / previous) * 100
      let changeRate: number | undefined;
      if (previousAmount > 0) {
        changeRate = Math.round(
          ((amount - previousAmount) / previousAmount) * 100
        );
      } else if (amount > 0) {
        // A category absent last month is new (shown as a 100% increase)
        changeRate = 100;
      }

      return {
        category,
        amount,
        percentage:
          totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
        subscriptionCount: categoryCounts.get(category) || 0,
        changeRate,
      };
    })
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 5); // Top 5 categories

  return result;
}

/**
 * Get top spending apps (including user count and unused rate)
 */
export async function getTopSpendingApps(
  limit: number = 10
): Promise<TopSpendingApp[]> {
  const { organizationId } = await requireOrganization();

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: SubscriptionStatus.ACTIVE,
    },
    include: {
      app: {
        select: {
          id: true,
          name: true,
          customLogoUrl: true,
          _count: {
            select: { userAccesses: true },
          },
        },
      },
    },
    orderBy: { amount: "desc" },
    take: limit,
  });

  return subscriptions.map((sub) => {
    const totalLicenses = sub.totalLicenses || 0;
    const usedLicenses = sub.app._count.userAccesses;
    // Unused rate: (total licenses - in use) / total licenses * 100
    const unusedRate =
      totalLicenses > 0
        ? Math.round(((totalLicenses - usedLicenses) / totalLicenses) * 100)
        : 0;

    return {
      id: sub.app.id,
      name: sub.app.name,
      logo: sub.app.customLogoUrl,
      userCount: usedLicenses,
      monthlyCost: Number(sub.amount || 0),
      totalLicenses: totalLicenses > 0 ? totalLicenses : undefined,
      unusedRate: totalLicenses > 0 ? unusedRate : undefined,
    };
  });
}

// ==================== Budget helpers ====================

/**
 * Get budget settings for the dashboard
 */
export async function getBudgetSettingsForDashboard(
  organizationId: string
): Promise<BudgetSettings> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!organization) {
    return DEFAULT_BUDGET_SETTINGS;
  }

  const settings = organization.settings as {
    budget?: Partial<BudgetSettings>;
  } | null;
  const budget = settings?.budget;

  if (!budget) {
    return DEFAULT_BUDGET_SETTINGS;
  }

  return {
    currency: budget.currency ?? DEFAULT_BUDGET_SETTINGS.currency,
    monthlyBudget:
      budget.monthlyBudget ?? DEFAULT_BUDGET_SETTINGS.monthlyBudget,
    alertThreshold:
      budget.alertThreshold ?? DEFAULT_BUDGET_SETTINGS.alertThreshold,
  };
}

/**
 * Get the monthly budget for the dashboard chart
 * - If monthlyBudget is set, return that value
 * - If not set (null), return last month's total approved card purchases
 */
export async function getMonthlyBudgetForDashboard(
  organizationId: string,
  month: Date,
  budgetSettings: BudgetSettings
): Promise<number> {
  // Return the budget if it is set
  if (budgetSettings.monthlyBudget !== null) {
    return budgetSettings.monthlyBudget;
  }

  // Fallback: last month's total approved card purchases
  const prevMonth = new Date(month);
  prevMonth.setMonth(prevMonth.getMonth() - 1);

  const year = prevMonth.getFullYear();
  const monthNum = prevMonth.getMonth() + 1;

  const prevMonthStart = `${year}${String(monthNum).padStart(2, "0")}01`;
  const prevMonthEnd = `${year}${String(monthNum).padStart(2, "0")}31`;

  const cardTransactions = await prisma.cardTransaction.aggregate({
    where: {
      organizationId,
      useDt: {
        gte: prevMonthStart,
        lte: prevMonthEnd,
      },
    },
    _sum: { useAmt: true },
  });

  // Handle the Decimal type
  const sum = cardTransactions._sum.useAmt;
  if (sum === null) {
    // Return 0 when there were no card purchases last month either
    return 0;
  }

  // Prisma Decimal has a toNumber() method
  if (typeof sum === "object" && "toNumber" in sum) {
    return (sum as { toNumber: () => number }).toNumber();
  }

  return Number(sum);
}
