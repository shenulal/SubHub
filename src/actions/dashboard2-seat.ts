// src/actions/dashboard2-seat.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { SeatWidgetData } from "@/types/dashboard";
import { SubscriptionStatus } from "@prisma/client";

/**
 * Get seat-status widget data
 * - Widget A: bottom 5 by utilization (wasted seats)
 * - Widget B: top 5 by number of licenses held
 */
export async function getSeatWidgetData(): Promise<SeatWidgetData> {
  const { organizationId } = await requireOrganization();

  // Fetch active PER_SEAT subscriptions (Widget A: utilization)
  const perSeatSubscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: SubscriptionStatus.ACTIVE,
      billingType: "PER_SEAT",
      totalLicenses: { gt: 0 },
    },
    include: {
      app: { select: { id: true, name: true } },
      assignedUsers: { select: { id: true } },
    },
  });

  // Calculate utilization
  const appsWithUtilization = perSeatSubscriptions
    .filter((sub) => (sub.totalLicenses ?? 0) > 0)
    .map((sub) => {
      const totalSeats = sub.totalLicenses!;
      const assignedSeats = sub.assignedUsers.length;
      const utilizationRate = Math.round((assignedSeats / totalSeats) * 100);
      return {
        appId: sub.app.id,
        appName: sub.app.name,
        totalSeats,
        assignedSeats,
        utilizationRate,
      };
    });

  // Widget A: sort by lowest utilization, top 5
  const lowUtilizationApps = [...appsWithUtilization]
    .sort((a, b) => a.utilizationRate - b.utilizationRate)
    .slice(0, 5);

  // Fetch active FLAT_RATE subscriptions (Widget B: top 5 individually licensed apps)
  const flatRateSubscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: SubscriptionStatus.ACTIVE,
      billingType: "FLAT_RATE",
    },
    include: {
      app: { select: { id: true, name: true } },
      assignedUsers: { select: { userId: true } },
    },
  });

  // Group by appId: sum user counts when one app has several FLAT_RATE subscriptions
  const appMap = new Map<string, { appName: string; userCount: number }>();
  for (const sub of flatRateSubscriptions) {
    const existing = appMap.get(sub.appId) ?? {
      appName: sub.app.name,
      userCount: 0,
    };
    existing.userCount += sub.assignedUsers.length;
    appMap.set(sub.appId, existing);
  }

  // Widget B: top 5 by userCount descending
  const topLicenseApps = [...appMap.entries()]
    .map(([appId, { appName, userCount }]) => ({ appId, appName, userCount }))
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 5);

  return {
    lowUtilizationApps,
    topLicenseApps,
  };
}
