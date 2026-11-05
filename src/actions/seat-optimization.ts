// src/actions/seat-optimization.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/types";
import type {
  SavingsOpportunitySummary,
  SeatOptimizationItem,
  SeatOptimizationSummary,
  SimulationResult,
} from "@/types/seat-analytics";

const INACTIVE_DAYS_THRESHOLD = 30;
const BUFFER_RATE = 1.15; // 15% buffer

function extractDecimal(val: unknown): number {
  if (val && typeof val === "object" && "toNumber" in val) {
    return (val as { toNumber: () => number }).toNumber();
  }
  return Number(val ?? 0);
}

/**
 * Seat optimization suggestions
 * Calculates the recommended seat count per app and the potential savings
 */
export async function getSeatOptimizationSuggestions(): Promise<
  ActionState<SeatOptimizationSummary>
> {
  try {
    const { organizationId } = await requireOrganization();

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_DAYS_THRESHOLD);

    // Fetch all active subscriptions with totalLicenses > 0 (any billingType)
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        totalLicenses: { gt: 0 },
      },
      include: {
        app: { select: { id: true, name: true, customLogoUrl: true } },
        assignedUsers: { select: { userId: true } },
      },
    });

    if (subscriptions.length === 0) {
      return {
        success: true,
        data: {
          totalMonthlySavings: 0,
          totalAnnualSavings: 0,
          optimizableAppCount: 0,
          items: [],
        },
      };
    }

    // Batch-fetch UserAppAccess
    const appIds = subscriptions.map((s) => s.app.id);
    const allUserIds = subscriptions.flatMap((s) =>
      s.assignedUsers.map((u) => u.userId)
    );

    const appAccesses =
      allUserIds.length > 0
        ? await prisma.userAppAccess.findMany({
            where: {
              appId: { in: appIds },
              userId: { in: allUserIds },
            },
            select: { userId: true, appId: true, lastUsedAt: true },
          })
        : [];

    const accessMap = new Map<string, Date | null>();
    for (const a of appAccesses) {
      accessMap.set(`${a.appId}:${a.userId}`, a.lastUsedAt);
    }

    const items: SeatOptimizationItem[] = [];

    for (const sub of subscriptions) {
      const currentSeats = sub.totalLicenses ?? 0;
      let perSeatPrice = extractDecimal(sub.perSeatPrice);

      // When there is no perSeatPrice (e.g. FLAT_RATE): estimate as amount / totalLicenses
      if (perSeatPrice === 0 && currentSeats > 0) {
        perSeatPrice = Math.round(extractDecimal(sub.amount) / currentSeats);
      }

      // Active users: only those with usage within 30 days (conservative approach)
      let activeUsers = 0;
      for (const su of sub.assignedUsers) {
        const key = `${sub.app.id}:${su.userId}`;
        const lastUsed = accessMap.get(key);
        if (lastUsed && lastUsed >= thresholdDate) {
          activeUsers++;
        }
      }

      const recommendedSeats = Math.ceil(activeUsers * BUFFER_RATE);
      const excessSeats = Math.max(0, currentSeats - recommendedSeats);

      if (excessSeats <= 0) continue; // no optimization needed

      const monthlySavings = excessSeats * perSeatPrice;

      items.push({
        subscriptionId: sub.id,
        appId: sub.app.id,
        appName: sub.app.name,
        appLogoUrl: sub.app.customLogoUrl,
        currentSeats,
        activeUsers,
        recommendedSeats,
        excessSeats,
        perSeatPrice,
        monthlySavings,
        annualSavings: monthlySavings * 12,
      });
    }

    items.sort((a, b) => b.monthlySavings - a.monthlySavings);

    const totalMonthlySavings = items.reduce((s, i) => s + i.monthlySavings, 0);

    return {
      success: true,
      data: {
        totalMonthlySavings,
        totalAnnualSavings: totalMonthlySavings * 12,
        optimizableAppCount: items.length,
        items,
      },
    };
  } catch (error) {
    console.error("Seat optimization suggestion error:", error);
    return {
      success: false,
      error: "Failed to generate seat optimization suggestions",
    };
  }
}

/**
 * Downsizing simulation
 */
export async function simulateSeatReduction(
  subscriptionId: string,
  targetSeats: number
): Promise<ActionState<SimulationResult>> {
  try {
    const { organizationId } = await requireOrganization();

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_DAYS_THRESHOLD);

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      include: {
        app: { select: { id: true, name: true } },
        assignedUsers: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const currentSeats = subscription.totalLicenses ?? 0;
    const perSeatPrice = extractDecimal(subscription.perSeatPrice);

    // Fetch UserAppAccess
    const userIds = subscription.assignedUsers.map((su) => su.userId);
    const appAccesses = await prisma.userAppAccess.findMany({
      where: {
        appId: subscription.app.id,
        userId: { in: userIds },
      },
      select: { userId: true, lastUsedAt: true },
    });

    const accessMap = new Map(appAccesses.map((a) => [a.userId, a.lastUsedAt]));

    // Inactive users = users affected by downsizing
    const affectedUsers = subscription.assignedUsers
      .filter((su) => {
        const lastUsed = accessMap.get(su.userId) ?? null;
        return !lastUsed || lastUsed < thresholdDate;
      })
      .map((su) => ({
        id: su.user.id,
        name: su.user.name,
        email: su.user.email,
        lastUsedAt: accessMap.get(su.userId) ?? null,
      }));

    return {
      success: true,
      data: {
        subscriptionId,
        appName: subscription.app.name,
        currentSeats,
        targetSeats,
        currentMonthlyCost: currentSeats * perSeatPrice,
        targetMonthlyCost: targetSeats * perSeatPrice,
        monthlySavings: (currentSeats - targetSeats) * perSeatPrice,
        annualSavings: (currentSeats - targetSeats) * perSeatPrice * 12,
        affectedUsers,
      },
    };
  } catch (error) {
    console.error("Seat downsizing simulation error:", error);
    return { success: false, error: "Simulation failed" };
  }
}

/**
 * Savings opportunity summary for the dashboard widget (top 3)
 */
export async function getSavingsOpportunitySummary(): Promise<
  ActionState<SavingsOpportunitySummary>
> {
  const result = await getSeatOptimizationSuggestions();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const topApps = result.data.items.slice(0, 3).map((item) => ({
    appName: item.appName,
    annualSavings: item.annualSavings,
  }));

  return {
    success: true,
    data: {
      totalAnnualSavings: result.data.totalAnnualSavings,
      topApps,
    },
  };
}
