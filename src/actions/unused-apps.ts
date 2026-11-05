// src/actions/unused-apps.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { extractMainDomain } from "@/lib/utils/domain-extractor";
import type { ActionState } from "@/types";

const INACTIVE_DAYS_THRESHOLD = 30;

export interface UnusedAppsResult {
  count: number;
  cost: number;
}

function toMonthlyAmount(amount: number, billingCycle: string): number {
  switch (billingCycle) {
    case "YEARLY":
      return amount / 12;
    case "QUARTERLY":
      return amount / 3;
    default:
      // MONTHLY, ONE_TIME
      return amount;
  }
}

function toNumber(value: unknown): number {
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

/**
 * Aggregate unused subscription cost (per-user subscription analysis)
 *
 * Usage is determined by UserAppAccess OR ExtensionUsage (OR condition)
 * - UserAppAccess: based on login events (lastUsedAt within the last 30 days)
 * - ExtensionUsage: based on browsing logs (date within the last 30 days, matched by app domain)
 *
 * Calculation by billing type:
 * - FLAT_RATE (default): in use if at least one assigned user is active
 * - PER_SEAT: number of inactive users × perSeatPrice
 *
 * count: number of unused subscriptions
 * cost: total monthly-equivalent cost of unused subscriptions
 */
export async function getUnusedApps(): Promise<ActionState<UnusedAppsResult>> {
  try {
    const { organizationId } = await requireOrganization();

    // 1) Fetch ACTIVE subscriptions (with assigned users and app domains)
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        appId: true,
        billingType: true,
        billingCycle: true,
        amount: true,
        perSeatPrice: true,
        totalLicenses: true,
        assignedUsers: { select: { userId: true } },
        app: {
          select: {
            customWebsite: true,
            catalog: {
              select: {
                website: true,
                patterns: {
                  where: { matchType: "DOMAIN" },
                  select: { pattern: true },
                },
              },
            },
          },
        },
      },
    });

    if (subscriptions.length === 0) {
      return { success: true, data: { count: 0, cost: 0 } };
    }

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_DAYS_THRESHOLD);

    // 2) Unique appId list
    const appIds = [...new Set(subscriptions.map((s) => s.appId))];

    // 3-1) UserAppAccess: login history within 30 days
    const recentAccesses = await prisma.userAppAccess.findMany({
      where: {
        appId: { in: appIds },
        lastUsedAt: { gte: thresholdDate },
      },
      select: { appId: true, userId: true },
    });

    // Set of "appId:userId" for fast lookup
    const accessSet = new Set(
      recentAccesses.map((a) => `${a.appId}:${a.userId}`)
    );

    // 3-2) Build the appId → domain[] reverse map (for ExtensionUsage matching)
    const domainToAppId = new Map<string, string>();
    for (const sub of subscriptions) {
      if (!sub.app) continue;
      const domains: string[] = [];

      if (sub.app.customWebsite) {
        const d = extractMainDomain(sub.app.customWebsite);
        if (d) domains.push(d);
      }
      if (sub.app.catalog?.website) {
        const d = extractMainDomain(sub.app.catalog.website);
        if (d) domains.push(d);
      }
      for (const p of sub.app.catalog?.patterns ?? []) {
        const d = p.pattern.toLowerCase().replace(/^\*\./, "");
        if (d) domains.push(d);
      }

      for (const d of domains) {
        domainToAppId.set(d, sub.appId);
      }
    }

    // 3-3) ExtensionUsage: browsing records within 30 days (by app domain)
    const usageSet = new Set<string>();
    if (domainToAppId.size > 0) {
      const recentUsages = await prisma.extensionUsage.findMany({
        where: {
          organizationId,
          domain: { in: [...domainToAppId.keys()] },
          date: { gte: thresholdDate },
          userId: { not: null },
        },
        select: { domain: true, userId: true },
      });

      for (const u of recentUsages) {
        const appId = domainToAppId.get(u.domain);
        if (appId && u.userId) {
          usageSet.add(`${appId}:${u.userId}`);
        }
      }
    }

    // Active user check: UserAppAccess OR ExtensionUsage
    const isActiveUser = (appId: string, userId: string): boolean =>
      accessSet.has(`${appId}:${userId}`) || usageSet.has(`${appId}:${userId}`);

    // 4) Calculate unused cost per subscription
    const unusedAppIds = new Set<string>(); // number of unused apps (counted per app, not per subscription)
    let totalMonthlyCost = 0;

    for (const sub of subscriptions) {
      const amount = toNumber(sub.amount);
      const monthlyAmount = toMonthlyAmount(amount, sub.billingCycle);
      const assignedUserIds = (sub.assignedUsers ?? []).map((u) => u.userId);

      if (sub.billingType === "PER_SEAT") {
        // inactive users × perSeatPrice
        const perSeatPrice =
          toNumber(sub.perSeatPrice) ||
          (sub.totalLicenses && sub.totalLicenses > 0
            ? monthlyAmount / sub.totalLicenses
            : 0);

        const inactiveCount = assignedUserIds.filter(
          (uid) => !isActiveUser(sub.appId, uid)
        ).length;

        if (inactiveCount > 0 && perSeatPrice > 0) {
          totalMonthlyCost += inactiveCount * perSeatPrice;
          unusedAppIds.add(sub.appId);
        }
      } else {
        // FLAT_RATE (default): unused if no assigned user is active
        const hasActiveUser = assignedUserIds.some((uid) =>
          isActiveUser(sub.appId, uid)
        );
        if (!hasActiveUser) {
          totalMonthlyCost += monthlyAmount;
          unusedAppIds.add(sub.appId);
        }
      }
    }

    return {
      success: true,
      data: {
        count: unusedAppIds.size,
        cost: Math.round(totalMonthlyCost),
      },
    };
  } catch (error) {
    console.error("Unused subscription query error:", error);
    return { success: false, error: "Failed to load unused subscriptions" };
  }
}
