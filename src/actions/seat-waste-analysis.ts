// src/actions/seat-waste-analysis.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/types";
import type {
  SeatWasteAnalysis,
  SeatWastePerApp,
  SeatWasteSummary,
} from "@/types/seat-analytics";

const INACTIVE_DAYS_THRESHOLD = 30;

/**
 * Detailed seat waste analysis per app
 * Analyzes unassigned/unused seats for every active subscription with totalLicenses
 * (FLAT_RATE subscriptions are included when they have totalLicenses)
 */
export async function getSeatWasteAnalysis(): Promise<
  ActionState<SeatWasteAnalysis>
> {
  try {
    const { organizationId } = await requireOrganization();

    // Fetch all active subscriptions with totalLicenses > 0 (any billingType)
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        totalLicenses: { gt: 0 },
      },
      include: {
        app: {
          select: { id: true, name: true, customLogoUrl: true },
        },
        assignedUsers: {
          select: { userId: true },
        },
      },
    });

    if (subscriptions.length === 0) {
      return {
        success: true,
        data: {
          summary: {
            totalMonthlyWaste: 0,
            totalAnnualWaste: 0,
            overallUtilizationRate: 100,
            appCount: 0,
            totalWastedSeats: 0,
          },
          apps: [],
        },
      };
    }

    const now = new Date();
    const thresholdDate = new Date(now);
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVE_DAYS_THRESHOLD);

    // Fetch UserAppAccess for all related appIds (batched)
    const appIds = subscriptions.map((s) => s.app.id);
    const allUserIds = subscriptions.flatMap((s) =>
      s.assignedUsers.map((u) => u.userId)
    );

    const appAccesses = await prisma.userAppAccess.findMany({
      where: {
        appId: { in: appIds },
        userId: { in: allUserIds },
      },
      select: {
        userId: true,
        appId: true,
        lastUsedAt: true,
      },
    });

    // appId+userId → lastUsedAt map
    const accessMap = new Map<string, Date | null>();
    for (const a of appAccesses) {
      accessMap.set(`${a.appId}:${a.userId}`, a.lastUsedAt);
    }

    let totalWastedSeats = 0;
    let totalSeatsAll = 0;
    let totalActiveSeats = 0;

    const apps: SeatWastePerApp[] = subscriptions.map((sub) => {
      const totalSeats = sub.totalLicenses ?? 0;
      const assignedUserIds = sub.assignedUsers.map((u) => u.userId);
      const assignedSeats = assignedUserIds.length;
      const unassignedSeats = Math.max(0, totalSeats - assignedSeats);

      // Active users: only those with usage within 30 days
      // Over-assigned (inactive): only when lastUsedAt exists and is older than 30 days (evidence-based)
      // No UserAppAccess record / null lastUsedAt → untracked (not over-assigned)
      let activeSeats = 0;
      let inactiveSeats = 0;
      for (const uid of assignedUserIds) {
        const key = `${sub.app.id}:${uid}`;
        const lastUsed = accessMap.get(key);
        if (lastUsed && lastUsed >= thresholdDate) {
          activeSeats++;
        } else if (lastUsed && lastUsed < thresholdDate) {
          inactiveSeats++; // evidence-based inactive
        }
        // else: no record or null lastUsedAt → untracked (not over-assigned)
      }
      const wastedSeats = unassignedSeats + inactiveSeats;
      const rawPrice = sub.perSeatPrice;
      let perSeatPrice =
        rawPrice && typeof rawPrice === "object" && "toNumber" in rawPrice
          ? (rawPrice as { toNumber: () => number }).toNumber()
          : Number(rawPrice ?? 0);

      // When there is no perSeatPrice (e.g. FLAT_RATE): estimate as amount / totalLicenses
      if (perSeatPrice === 0 && totalSeats > 0) {
        const rawAmount = sub.amount;
        const amount =
          rawAmount && typeof rawAmount === "object" && "toNumber" in rawAmount
            ? (rawAmount as { toNumber: () => number }).toNumber()
            : Number(rawAmount ?? 0);
        perSeatPrice = Math.round(amount / totalSeats);
      }
      const monthlyWaste = wastedSeats * perSeatPrice;
      const utilizationRate =
        totalSeats > 0 ? Math.round((activeSeats / totalSeats) * 100) : 0;

      totalWastedSeats += wastedSeats;
      totalSeatsAll += totalSeats;
      totalActiveSeats += activeSeats;

      return {
        appId: sub.app.id,
        appName: sub.app.name,
        appLogoUrl: sub.app.customLogoUrl,
        totalSeats,
        assignedSeats,
        activeSeats,
        unassignedSeats,
        inactiveSeats,
        wastedSeats,
        perSeatPrice,
        monthlyWaste,
        annualWaste: monthlyWaste * 12,
        utilizationRate,
      };
    });

    // Sort by waste amount, descending
    apps.sort((a, b) => b.monthlyWaste - a.monthlyWaste);

    const totalMonthlyWaste = apps.reduce((s, a) => s + a.monthlyWaste, 0);
    const overallUtilizationRate =
      totalSeatsAll > 0
        ? Math.round((totalActiveSeats / totalSeatsAll) * 100)
        : 100;

    return {
      success: true,
      data: {
        summary: {
          totalMonthlyWaste,
          totalAnnualWaste: totalMonthlyWaste * 12,
          overallUtilizationRate,
          appCount: apps.length,
          totalWastedSeats,
        },
        apps,
      },
    };
  } catch (error) {
    console.error("Seat waste analysis error:", error);
    return { success: false, error: "Seat waste analysis failed" };
  }
}

/**
 * Seat waste summary for the dashboard widget
 */
export async function getSeatWasteSummary(): Promise<
  ActionState<SeatWasteSummary>
> {
  const result = await getSeatWasteAnalysis();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data.summary };
}
