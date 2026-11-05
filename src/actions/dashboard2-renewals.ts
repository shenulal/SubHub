// src/actions/dashboard2-renewals.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { UrgentRenewalSummary } from "@/types/dashboard2";
import { SubscriptionStatus, UserStatus } from "@prisma/client";

/**
 * Get an urgent-renewal summary for the next 30 days (with 7/15-day breakdown)
 */
export async function getUrgentRenewals(): Promise<UrgentRenewalSummary> {
  const { organizationId } = await requireOrganization();

  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const fifteenDaysLater = new Date(now);
  fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);

  const thirtyDaysLater = new Date(now);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

  const renewals = await prisma.subscription.findMany({
    where: {
      organizationId,
      renewalDate: {
        gte: now,
        lte: thirtyDaysLater,
      },
      status: SubscriptionStatus.ACTIVE,
    },
    include: {
      app: { select: { name: true } },
    },
    orderBy: { renewalDate: "asc" },
  });

  // Everything within 30 days
  const thirtyDayCount = renewals.length;
  const thirtyDayAmount = renewals.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  // Filter to within 7 days
  const sevenDayRenewals = renewals.filter(
    (r) => r.renewalDate && new Date(r.renewalDate) <= sevenDaysLater
  );
  const sevenDayCount = sevenDayRenewals.length;
  const sevenDayAmount = sevenDayRenewals.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  // Filter to within 15 days
  const fifteenDayRenewals = renewals.filter(
    (r) => r.renewalDate && new Date(r.renewalDate) <= fifteenDaysLater
  );
  const fifteenDayCount = fifteenDayRenewals.length;
  const fifteenDayAmount = fifteenDayRenewals.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  const critical = renewals[0];

  return {
    thirtyDayCount,
    thirtyDayAmount,
    fifteenDayCount,
    fifteenDayAmount,
    sevenDayCount,
    sevenDayAmount,
    criticalApp: critical
      ? {
          name: critical.app.name,
          renewalDate: critical.renewalDate!,
        }
      : null,
  };
}

/**
 * Get unrecovered accounts of terminated users
 * TERMINATED users who still have app access
 */
export async function getUnrecoveredAccounts(): Promise<{
  totalCount: number;
  users: {
    id: string;
    name: string;
    email: string;
    terminatedAt: Date;
    unrecoveredApps: number;
  }[];
}> {
  const { organizationId } = await requireOrganization();

  // Fetch TERMINATED users who still have app access
  const terminatedUsers = await prisma.user.findMany({
    where: {
      organizationId,
      status: UserStatus.TERMINATED,
      appAccesses: {
        some: {}, // at least one app access grant
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      terminatedAt: true,
      _count: {
        select: { appAccesses: true },
      },
    },
    orderBy: { terminatedAt: "desc" },
    take: 10,
  });

  return {
    totalCount: terminatedUsers.length,
    users: terminatedUsers.map((user) => ({
      id: user.id,
      name: user.name || user.email.split("@")[0],
      email: user.email,
      terminatedAt: user.terminatedAt || new Date(),
      unrecoveredApps: user._count.appAccesses,
    })),
  };
}
