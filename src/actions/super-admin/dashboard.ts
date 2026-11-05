// src/actions/super-admin/dashboard.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";

export interface SuperAdminStats {
  totalUsers: number;
  activeUsers: number;
  totalSubscriptions: number;
  monthlyTotalCost: number;
  currency: string;
  latestBuildVersion: string | null;
  latestBuildDate: Date | null;
}

export interface AppSubscriptionSummary {
  appId: string;
  appName: string;
  logoUrl: string | null;
  subscriptionCount: number;
  totalMonthlyCost: number;
  currency: string;
}

/**
 * Super Admin overview statistics
 */
async function _getSuperAdminStats(): Promise<ActionState<SuperAdminStats>> {
  await requireSuperAdmin();

  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!org) {
    return { success: false, message: "Tenant information not found." };
  }

  const [totalUsers, activeUsers, subscriptions, latestBuild] =
    await Promise.all([
      prisma.user.count({ where: { organizationId: org.id } }),
      prisma.user.count({
        where: { organizationId: org.id, status: "ACTIVE" },
      }),
      prisma.subscription.findMany({
        where: { organizationId: org.id, status: "ACTIVE" },
        select: { amount: true, currency: true, billingCycle: true },
      }),
      prisma.extensionBuild.findFirst({
        where: { organizationId: org.id, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { version: true, createdAt: true },
      }),
    ]);

  // Compute the monthly-equivalent cost
  let monthlyTotalCost = 0;
  const currency =
    subscriptions[0]?.currency ?? (await getBaseCurrency(org.id));

  for (const sub of subscriptions) {
    const amount = Number(sub.amount);
    switch (sub.billingCycle) {
      case "MONTHLY":
        monthlyTotalCost += amount;
        break;
      case "QUARTERLY":
        monthlyTotalCost += amount / 3;
        break;
      case "YEARLY":
        monthlyTotalCost += amount / 12;
        break;
      default:
        monthlyTotalCost += amount;
    }
  }

  return {
    success: true,
    data: {
      totalUsers,
      activeUsers,
      totalSubscriptions: subscriptions.length,
      monthlyTotalCost: Math.round(monthlyTotalCost),
      currency,
      latestBuildVersion: latestBuild?.version ?? null,
      latestBuildDate: latestBuild?.createdAt ?? null,
    },
  };
}

export const getSuperAdminStats = withLogging(
  "getSuperAdminStats",
  _getSuperAdminStats
);

/**
 * Subscription summary per app
 */
async function _getResourceUsage(): Promise<
  ActionState<AppSubscriptionSummary[]>
> {
  await requireSuperAdmin();

  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!org) {
    return { success: false, message: "Tenant information not found." };
  }

  const subscriptions = await prisma.subscription.findMany({
    where: { organizationId: org.id, status: "ACTIVE" },
    include: {
      app: {
        select: {
          id: true,
          name: true,
          catalog: { select: { logoUrl: true } },
          customLogoUrl: true,
        },
      },
    },
    orderBy: { amount: "desc" },
  });

  const summaryMap = new Map<string, AppSubscriptionSummary>();

  for (const sub of subscriptions) {
    const appId = sub.app.id;
    const amount = Number(sub.amount);
    let monthlyCost = amount;

    switch (sub.billingCycle) {
      case "QUARTERLY":
        monthlyCost = amount / 3;
        break;
      case "YEARLY":
        monthlyCost = amount / 12;
        break;
    }

    if (summaryMap.has(appId)) {
      const existing = summaryMap.get(appId)!;
      existing.subscriptionCount += 1;
      existing.totalMonthlyCost += monthlyCost;
    } else {
      summaryMap.set(appId, {
        appId,
        appName: sub.app.name,
        logoUrl: sub.app.customLogoUrl ?? sub.app.catalog?.logoUrl ?? null,
        subscriptionCount: 1,
        totalMonthlyCost: Math.round(monthlyCost),
        currency: sub.currency,
      });
    }
  }

  return {
    success: true,
    data: Array.from(summaryMap.values()).sort(
      (a, b) => b.totalMonthlyCost - a.totalMonthlyCost
    ),
  };
}

export const getResourceUsage = withLogging(
  "getResourceUsage",
  _getResourceUsage
);
