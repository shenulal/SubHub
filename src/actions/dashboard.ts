// src/actions/dashboard.ts
"use server";

import { describeAuditAction } from "@/lib/audit/describe-action";
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { inFilter } from "@/lib/filters/multi-value";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { withReportAccess } from "@/lib/rbac/report-access";
import { advanceToFutureDate } from "@/lib/utils/renewal-date";
import type {
  CategoryDistribution,
  DashboardStats,
  RecentActivityItem,
  RenewalReportData,
  SubscriptionAnomalyItem,
  UpcomingRenewal,
} from "@/types/dashboard";
import { type ReportScope, resolveReportScope } from "./cost-analytics-scope";

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const { organizationId } = await requireOrganization();

  const [totalApps, activeSubscriptions, totalUsers, costData] =
    await Promise.all([
      prisma.app.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.subscription.count({
        where: { organizationId, status: "ACTIVE" },
      }),
      prisma.user.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.subscription.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { amount: true, billingCycle: true },
      }),
    ]);

  // Monthly cost (YEARLY /12, QUARTERLY /3)
  const totalMonthlyCost = costData.reduce((sum, sub) => {
    const amount = Number(sub.amount);
    if (sub.billingCycle === "YEARLY") return sum + amount / 12;
    if (sub.billingCycle === "QUARTERLY") return sum + amount / 3;
    return sum + amount;
  }, 0);

  const baseCurrency = await getBaseCurrency(organizationId);

  return {
    totalApps,
    activeSubscriptions,
    totalUsers,
    totalMonthlyCost: Math.round(totalMonthlyCost),
    currency: baseCurrency,
  };
}

/**
 * Count ACTIVE apps that have no linked subscription
 */
export async function getAppsWithoutSubscriptions(): Promise<{
  count: number;
  totalActiveApps: number;
}> {
  const { organizationId } = await requireOrganization();

  const [appsWithoutSub, totalActiveApps] = await Promise.all([
    prisma.app.count({
      where: {
        organizationId,
        status: "ACTIVE",
        subscriptions: { none: {} },
      },
    }),
    prisma.app.count({
      where: { organizationId, status: "ACTIVE" },
    }),
  ]);

  return { count: appsWithoutSub, totalActiveApps };
}

/**
 * Count unrecovered accounts of terminated users
 */
export async function getTerminatedUsersCount(): Promise<number> {
  const { organizationId } = await requireOrganization();

  return prisma.user.count({
    where: {
      organizationId,
      status: "TERMINATED",
      appAccesses: { some: {} },
    },
  });
}

/**
 * Count terminated users who still have subscription assignments (SubscriptionUser)
 */
export async function getTerminatedUsersWithSubCount(): Promise<number> {
  const { organizationId } = await requireOrganization();

  return prisma.user.count({
    where: {
      organizationId,
      status: "TERMINATED",
      subscriptionAssignments: { some: {} },
    },
  });
}

/**
 * Count unrecovered subscription assignments (SubscriptionUser) of terminated users
 */
export async function getTerminatedUsersSubAssignmentCount(): Promise<number> {
  const { organizationId } = await requireOrganization();

  return prisma.subscriptionUser.count({
    where: {
      user: {
        organizationId,
        status: "TERMINATED",
      },
    },
  });
}

/**
 * Get subscriptions renewing within 30 days (max 5)
 * @param options.teamId - Team ID (for the MEMBER role, only that team's subscriptions)
 */
export async function getUpcomingRenewals(
  options: { teamId?: string | null } = {}
): Promise<UpcomingRenewal[]> {
  const { organizationId } = await requireOrganization();

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      renewalDate: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      ...(options.teamId ? { teamId: options.teamId } : {}),
    },
    include: {
      app: {
        include: { catalog: true },
      },
    },
    orderBy: { renewalDate: "asc" },
    take: 5,
  });

  return subscriptions.map((sub) => {
    const daysUntilRenewal = Math.ceil(
      (sub.renewalDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: sub.id,
      appName: sub.app.name,
      appLogoUrl:
        sub.app.catalog?.logoUrl ?? sub.app.customLogoUrl ?? undefined,
      renewalDate: sub.renewalDate!,
      amount: Number(sub.amount),
      currency: sub.currency,
      daysUntilRenewal,
    };
  });
}

/**
 * Get app distribution by category
 */
export async function getAppsByCategory(): Promise<CategoryDistribution[]> {
  const { organizationId } = await requireOrganization();

  const groups = await prisma.app.groupBy({
    by: ["category"],
    where: { organizationId, status: "ACTIVE" },
    _count: { _all: true },
  });

  const total = groups.reduce((sum, g) => sum + g._count._all, 0);

  return groups.map((g) => ({
    category: g.category ?? "__UNCATEGORIZED__",
    count: g._count._all,
    percentage: total > 0 ? Math.round((g._count._all / total) * 100) : 0,
  }));
}

/**
 * Get recent activity (max 10)
 * @param options.userId - User ID (for the MEMBER role, only the user's own activity)
 */
export async function getRecentActivity(
  options: { userId?: string } = {}
): Promise<RecentActivityItem[]> {
  const { organizationId } = await requireOrganization();

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(options.userId ? { userId: options.userId } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ?? undefined,
    userName: log.user?.name ?? undefined,
    userEmail: log.user?.email ?? undefined,
    createdAt: log.createdAt,
    description: describeAuditAction(log.action),
  }));
}

/**
 * Detect subscription anomalies
 * - FLAT_RATE: active subscriptions with zero assigned users
 * - PER_SEAT: active subscriptions where usedLicenses < totalLicenses
 * Returns at most 5
 */
export async function getSubscriptionAnomalies(): Promise<
  SubscriptionAnomalyItem[]
> {
  const { organizationId } = await requireOrganization();

  const [flatRateAnomalies, perSeatAnomalies] = await Promise.all([
    // FLAT_RATE: active subscriptions with zero assigned users
    prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        billingType: "FLAT_RATE",
        assignedUsers: { none: {} },
      },
      include: { app: { select: { name: true } } },
      take: 5,
    }),
    // PER_SEAT: active subscriptions with spare seats
    prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        billingType: "PER_SEAT",
        totalLicenses: { gt: 0 },
      },
      include: { app: { select: { name: true } } },
      take: 5,
    }),
  ]);

  const results: SubscriptionAnomalyItem[] = [];

  for (const sub of flatRateAnomalies) {
    results.push({
      subscriptionId: sub.id,
      appName: sub.app.name,
      billingType: "FLAT_RATE",
    });
  }

  for (const sub of perSeatAnomalies) {
    const total = sub.totalLicenses ?? 0;
    const used = sub.usedLicenses ?? 0;
    if (used >= total) continue;

    const perSeatPrice = Number(sub.perSeatPrice ?? 0);
    const savableAmount = (total - used) * perSeatPrice;

    results.push({
      subscriptionId: sub.id,
      appName: sub.app.name,
      billingType: "PER_SEAT",
      totalLicenses: total,
      usedLicenses: used,
      savableAmount,
    });
  }

  return results.slice(0, 5);
}

/**
 * Count active users who have not completed extension onboarding
 * - Users with an extension device installed but onboarding not completed
 */
export async function getPendingOnboardingCount(): Promise<number> {
  const { organizationId } = await requireOrganization();

  return prisma.user.count({
    where: {
      organizationId,
      status: "ACTIVE",
      extensionDevices: {
        some: { onboardingCompletedAt: null },
      },
    },
  });
}

/**
 * Narrow a renewal query to the selected users (assigned) or teams (owning
 * team or a member assigned); several ids use `in`, none = no filter.
 */
function applyRenewalScope(
  where: Record<string, unknown>,
  scope: ReportScope
): void {
  const users = inFilter(scope.userIds);
  const teams = inFilter(scope.teamIds);
  if (users) {
    where.assignedUsers = scope.enforceTeamId
      ? { some: { userId: users, user: { teamId: scope.enforceTeamId } } }
      : { some: { userId: users } };
  } else if (teams) {
    where.OR = [
      { teamId: teams },
      { assignedUsers: { some: { user: { teamId: teams } } } },
    ];
  }
}

/**
 * Get renewals for reports (all periods, grouped by period)
 */
export async function getRenewalReportData(
  filters: {
    teamId?: string;
    userId?: string;
    /** Multi-select team / user filters (empty = all). */
    teamIds?: string[];
    userIds?: string[];
  } = {}
): Promise<RenewalReportData> {
  const {
    organizationId,
    role,
    teamId: memberTeamId,
    userId,
  } = await requireOrganization();

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  const scope = resolveReportScope(
    filters,
    await withReportAccess({ id: userId, role, teamId: memberTeamId })
  );
  const where: Record<string, unknown> = {
    organizationId,
    status: "ACTIVE",
    renewalDate: {
      gte: now,
      lte: ninetyDaysFromNow,
    },
  };
  applyRenewalScope(where, scope);

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: {
      app: {
        include: { catalog: true },
      },
      team: {
        select: { id: true, name: true },
      },
      assignedUsers: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { renewalDate: "asc" },
  });

  // Safeguard: fetch subscriptions with autoRenewal=true but a past renewalDate
  // so the report still works when the cron job has not run
  const overdueWhere: Record<string, unknown> = {
    organizationId,
    status: "ACTIVE",
    autoRenewal: true,
    billingCycle: { not: "ONE_TIME" },
    renewalDate: { lt: now },
  };

  applyRenewalScope(overdueWhere, scope);

  const overdueSubscriptions = await prisma.subscription.findMany({
    where: overdueWhere,
    include: {
      app: {
        include: { catalog: true },
      },
      team: {
        select: { id: true, name: true },
      },
      assignedUsers: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { renewalDate: "asc" },
  });

  // Subscription IDs already included in the existing query
  const existingIds = new Set(subscriptions.map((s) => s.id));

  // Roll past renewal dates forward and add only those within 90 days
  const overdueWithCalculatedDates = overdueSubscriptions
    .filter((sub) => !existingIds.has(sub.id) && sub.renewalDate)
    .map((sub) => {
      const nextDate = advanceToFutureDate(sub.renewalDate!, sub.billingCycle);
      return { ...sub, renewalDate: nextDate };
    })
    .filter((sub) => sub.renewalDate <= ninetyDaysFromNow);

  // Merge with existing results
  const allSubscriptions = [...subscriptions, ...overdueWithCalculatedDates];

  const mapToRenewal = (sub: (typeof allSubscriptions)[0]): UpcomingRenewal => {
    const daysUntilRenewal = Math.ceil(
      (sub.renewalDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: sub.id,
      appName: sub.app.name,
      appLogoUrl:
        sub.app.catalog?.logoUrl ?? sub.app.customLogoUrl ?? undefined,
      renewalDate: sub.renewalDate!,
      amount: Number(sub.amount),
      currency: sub.currency,
      daysUntilRenewal,
      teamId: sub.teamId ?? null,
      teamName: sub.team?.name ?? null,
      assignedUsers: sub.assignedUsers.map((assignment) => ({
        id: assignment.userId,
        name: assignment.user.name,
        email: assignment.user.email,
      })),
    };
  };

  const within7Days: UpcomingRenewal[] = [];
  const within30Days: UpcomingRenewal[] = [];
  const within90Days: UpcomingRenewal[] = [];
  let totalRenewalCost = 0;

  allSubscriptions.forEach((sub) => {
    const renewal = mapToRenewal(sub);
    totalRenewalCost += renewal.amount;

    if (sub.renewalDate! <= sevenDaysFromNow) {
      within7Days.push(renewal);
    } else if (sub.renewalDate! <= thirtyDaysFromNow) {
      within30Days.push(renewal);
    } else {
      within90Days.push(renewal);
    }
  });

  return {
    within7Days,
    within30Days,
    within90Days,
    totalRenewalCost,
    totalCount: allSubscriptions.length,
  };
}
