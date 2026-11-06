// src/actions/usage-analytics.ts
"use server";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { inFilter } from "@/lib/filters/multi-value";
import { withReportAccess } from "@/lib/rbac/report-access";
import type { Prisma } from "@prisma/client";
import { resolveReportScope } from "./cost-analytics-scope";

// Type definitions
export interface UsageReportFilters {
  period: "30d" | "90d" | "1y" | "custom";
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  teamId?: string;
  userId?: string;
  /** Multi-select team / user filters (empty = all). */
  teamIds?: string[];
  userIds?: string[];
}

export interface UsageReportData {
  activeUsersTrend: Array<{ date: string; count: number }>;
  appUsageRanking: Array<{
    appId: string;
    appName: string;
    userCount: number;
    usageRate: number;
  }>;
  unusedApps: Array<{
    appId: string;
    appName: string;
    lastUsedAt: string | null;
    licenseCount: number | null;
    monthlyWastedCost: number;
  }>;
  summary: {
    totalActiveUsers: number;
    totalApps: number;
    unusedAppsCount: number;
    averageUsageRate: number;
  };
}

export type UsageExportFormat = "csv" | "excel";

/**
 * Get subscribed app IDs (shared helper)
 *
 * - Unfiltered: return all apps with ACTIVE subscriptions in the organization
 * - User/team filter: return only apps of subscriptions assigned to that user via SubscriptionUser
 */
async function getSubscribedAppIds(
  organizationId: string,
  userScope: Prisma.UserWhereInput,
  hasUserFilter: boolean
): Promise<string[]> {
  if (hasUserFilter) {
    // User/team filter: only apps with subscriptions assigned to the user
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        assignedUsers: {
          some: {
            user: userScope,
          },
        },
      },
      select: { appId: true },
      distinct: ["appId"],
    });
    return subscriptions.map((s) => s.appId);
  }

  // Unfiltered: all apps with ACTIVE subscriptions in the organization
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: { appId: true },
    distinct: ["appId"],
  });
  return subscriptions.map((s) => s.appId);
}

/**
 * User scope for the usage report: several teams and/or users (empty = all).
 * Restricted roles are pinned to their own team (or themselves without one).
 */
function buildUsageUserScope(
  organizationId: string,
  filters: Pick<
    UsageReportFilters,
    "teamId" | "userId" | "teamIds" | "userIds"
  >,
  sessionUser: {
    id: string;
    role?: string | null;
    teamId?: string | null;
    canReadAll?: boolean;
  }
): { userScope: Prisma.UserWhereInput; hasUserFilter: boolean } {
  const scope = resolveReportScope(filters, sessionUser);
  const teams = inFilter(scope.teamIds);
  const users = inFilter(scope.userIds);
  return {
    userScope: {
      organizationId,
      ...(teams ? { teamId: teams } : {}),
      ...(users ? { id: users } : {}),
    },
    hasUserFilter: Boolean(teams || users),
  };
}

/**
 * Get usage report data
 */
export async function getUsageReport(
  filters: UsageReportFilters
): Promise<UsageReportData> {
  const {
    organizationId,
    role,
    teamId: memberTeamId,
    userId,
  } = await requireOrganization();

  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);

  const { userScope, hasUserFilter } = buildUsageUserScope(
    organizationId,
    filters,
    await withReportAccess({ id: userId, role, teamId: memberTeamId })
  );

  // Fetch subscribed app IDs once and reuse them
  const subscribedAppIds = await getSubscribedAppIds(
    organizationId,
    userScope,
    hasUserFilter
  );

  // Count of all ACTIVE apps (regardless of subscriptions)
  const totalApps = await prisma.app.count({
    where: { organizationId, status: "ACTIVE" },
  });

  // With no subscribed apps, active users/usage rate are 0 but totalApps returns the real count
  if (subscribedAppIds.length === 0) {
    return {
      activeUsersTrend: [],
      appUsageRanking: [],
      unusedApps: [],
      summary: {
        totalActiveUsers: 0,
        totalApps,
        unusedAppsCount: 0,
        averageUsageRate: 0,
      },
    };
  }

  // Run independent queries in parallel
  const [activeUsersTrend, appUsageRanking, unusedApps, activeUserRecords] =
    await Promise.all([
      // Active user trend
      getActiveUsersTrendInternal(
        startDate,
        endDate,
        userScope,
        subscribedAppIds
      ),
      // Usage rate ranking per app
      getAppUsageRankingInternal(
        organizationId,
        userScope,
        subscribedAppIds,
        10
      ),
      // Unused apps (reflecting the selected period)
      getUnusedAppsInternal(
        organizationId,
        userScope,
        hasUserFilter,
        startDate
      ),
      // Total active users: users with lastUsedAt within the period on subscribed apps
      prisma.userAppAccess.findMany({
        where: {
          user: userScope,
          appId: { in: subscribedAppIds },
          lastUsedAt: { gte: startDate, lte: endDate },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

  const totalActiveUsers = activeUserRecords.length;

  // Calculate the average usage rate
  const averageUsageRate =
    appUsageRanking.length > 0
      ? appUsageRanking.reduce((sum, app) => sum + app.usageRate, 0) /
        appUsageRanking.length
      : 0;

  return {
    activeUsersTrend,
    appUsageRanking,
    unusedApps,
    summary: {
      totalActiveUsers,
      totalApps,
      unusedAppsCount: unusedApps.length,
      averageUsageRate: Math.round(averageUsageRate * 10) / 10,
    },
  };
}

/**
 * Get the active user trend (internal)
 * Aggregated only by lastUsedAt on subscribed apps
 */
async function getActiveUsersTrendInternal(
  startDate: Date,
  endDate: Date,
  userScope: Prisma.UserWhereInput,
  subscribedAppIds: string[]
): Promise<Array<{ date: string; count: number }>> {
  if (subscribedAppIds.length === 0) {
    return [];
  }

  const accesses = await prisma.userAppAccess.findMany({
    where: {
      user: userScope,
      appId: { in: subscribedAppIds },
      lastUsedAt: { gte: startDate, lte: endDate },
    },
    select: {
      userId: true,
      lastUsedAt: true,
    },
  });

  // Count unique users per date
  const trendMap = new Map<string, Set<string>>();

  for (const access of accesses) {
    if (access.lastUsedAt) {
      const dateKey = access.lastUsedAt.toISOString().split("T")[0];
      if (!trendMap.has(dateKey)) {
        trendMap.set(dateKey, new Set());
      }
      trendMap.get(dateKey)!.add(access.userId);
    }
  }

  // Convert the Map to an array
  const result: Array<{ date: string; count: number }> = [];
  trendMap.forEach((userSet, date) => {
    result.push({ date, count: userSet.size });
  });

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

/**
 * Get the active user trend (for external callers)
 */
export async function getActiveUsersTrend(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; count: number }>> {
  const {
    organizationId,
    role,
    teamId: memberTeamId,
    userId,
  } = await requireOrganization();

  const { canReadAll } = await withReportAccess({ role });
  const isRestricted = !canReadAll;
  const effectiveTeamId = isRestricted
    ? (memberTeamId ?? undefined)
    : undefined;
  const effectiveUserId = isRestricted && !memberTeamId ? userId : undefined;

  const hasUserFilter = !!(effectiveTeamId || effectiveUserId);

  const userScope: Prisma.UserWhereInput = {
    organizationId,
    ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
    ...(effectiveUserId ? { id: effectiveUserId } : {}),
  };

  const subscribedAppIds = await getSubscribedAppIds(
    organizationId,
    userScope,
    hasUserFilter
  );

  return getActiveUsersTrendInternal(
    new Date(startDate),
    new Date(endDate),
    userScope,
    subscribedAppIds
  );
}

/**
 * Get the usage rate ranking per app (internal)
 *
 * - Logged-in users = users whose UserAppAccess.lastUsedAt is not null (subscribed apps only)
 * - Assigned users = number of SubscriptionUser rows for the app's subscriptions
 * - usageRate = (logged-in users / assigned users) × 100
 */
async function getAppUsageRankingInternal(
  organizationId: string,
  userScope: Prisma.UserWhereInput,
  subscribedAppIds: string[],
  limit?: number
): Promise<
  Array<{
    appId: string;
    appName: string;
    userCount: number;
    usageRate: number;
  }>
> {
  if (subscribedAppIds.length === 0) {
    return [];
  }

  // Logged-in users per subscribed app (lastUsedAt not null)
  const loginRecords = await prisma.userAppAccess.findMany({
    where: {
      user: userScope,
      appId: { in: subscribedAppIds },
      lastUsedAt: { not: null },
    },
    select: { appId: true, userId: true },
  });

  // Count logged-in users per app
  const appLoginMap = new Map<string, Set<string>>();
  for (const record of loginRecords) {
    if (!appLoginMap.has(record.appId)) {
      appLoginMap.set(record.appId, new Set());
    }
    appLoginMap.get(record.appId)!.add(record.userId);
  }

  // Assigned users per subscribed app (SubscriptionUser)
  const assignedCounts = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      appId: { in: subscribedAppIds },
    },
    select: {
      appId: true,
      _count: { select: { assignedUsers: true } },
    },
  });

  // Map of assigned users per app
  const appAssignedMap = new Map<string, number>();
  for (const sub of assignedCounts) {
    const current = appAssignedMap.get(sub.appId) || 0;
    appAssignedMap.set(sub.appId, current + sub._count.assignedUsers);
  }

  // Fetch app names
  const apps = await prisma.app.findMany({
    where: { id: { in: subscribedAppIds } },
    select: { id: true, name: true },
  });
  const appNameMap = new Map(apps.map((app) => [app.id, app.name]));

  // Calculate ranking
  const ranked = subscribedAppIds
    .map((appId) => {
      const loginCount = appLoginMap.get(appId)?.size || 0;
      const assignedCount = appAssignedMap.get(appId) || 0;
      return {
        appId,
        appName: appNameMap.get(appId) || "Unknown",
        userCount: loginCount,
        usageRate:
          assignedCount > 0
            ? Math.round((loginCount / assignedCount) * 100 * 10) / 10
            : 0,
      };
    })
    .sort((a, b) => b.userCount - a.userCount);

  return limit ? ranked.slice(0, limit) : ranked;
}

/**
 * Get the usage rate ranking per app (for external callers)
 */
export async function getAppUsageRanking(): Promise<
  Array<{
    appId: string;
    appName: string;
    userCount: number;
    usageRate: number;
  }>
> {
  const { organizationId } = await requireOrganization();

  const userScope: Prisma.UserWhereInput = { organizationId };
  const subscribedAppIds = await getSubscribedAppIds(
    organizationId,
    userScope,
    false
  );

  return getAppUsageRankingInternal(
    organizationId,
    userScope,
    subscribedAppIds,
    10
  );
}

/**
 * Normalize a subscription amount to a monthly cost
 */
function toMonthlyCost(amount: number, billingCycle: string): number {
  switch (billingCycle) {
    case "YEARLY":
      return amount / 12;
    case "QUARTERLY":
      return amount / 3;
    case "MONTHLY":
      return amount;
    case "ONE_TIME":
    default:
      return 0;
  }
}

/**
 * Get unused apps (internal)
 * Subscribed apps with no login history within the given period
 */
async function getUnusedAppsInternal(
  organizationId: string,
  userScope: Prisma.UserWhereInput,
  hasUserFilter: boolean,
  periodStart?: Date
): Promise<
  Array<{
    appId: string;
    appName: string;
    lastUsedAt: string | null;
    licenseCount: number | null;
    monthlyWastedCost: number;
  }>
> {
  const cutoff =
    periodStart ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    })();

  const apps = await prisma.app.findMany({
    where: {
      organizationId,
      subscriptions: {
        some: {
          status: "ACTIVE",
          ...(hasUserFilter
            ? { assignedUsers: { some: { user: userScope } } }
            : {}),
        },
      },
      userAccesses: {
        none: {
          lastUsedAt: { gte: cutoff },
          user: userScope,
        },
      },
    },
    select: {
      id: true,
      name: true,
      subscriptions: {
        select: { totalLicenses: true, amount: true, billingCycle: true },
        where: { status: "ACTIVE" },
      },
      userAccesses: {
        select: { lastUsedAt: true },
        orderBy: { lastUsedAt: "desc" },
        take: 1,
      },
    },
  });

  return apps.map((app) => {
    const monthlyCost = app.subscriptions.reduce(
      (sum, sub) => sum + toMonthlyCost(Number(sub.amount), sub.billingCycle),
      0
    );
    return {
      appId: app.id,
      appName: app.name,
      lastUsedAt: app.userAccesses[0]?.lastUsedAt?.toISOString() || null,
      licenseCount: app.subscriptions[0]?.totalLicenses || null,
      monthlyWastedCost: Math.round(monthlyCost),
    };
  });
}

/**
 * Get unused apps (for external callers)
 */
export async function getUnusedApps(): Promise<
  Array<{
    appId: string;
    appName: string;
    lastUsedAt: string | null;
    licenseCount: number | null;
    monthlyWastedCost: number;
  }>
> {
  const { organizationId } = await requireOrganization();
  const userScope: Prisma.UserWhereInput = { organizationId };

  return getUnusedAppsInternal(organizationId, userScope, false);
}

/**
 * Build usage export data
 */
export async function getUsageExportData(filters: UsageReportFilters): Promise<{
  summary: UsageReportData["summary"];
  activeUsersTrend: UsageReportData["activeUsersTrend"];
  appUsage: Array<{
    appName: string;
    userCount: number;
    usageRate: string;
  }>;
  unusedApps: Array<{
    appName: string;
    lastUsedAt: string;
    licenseCount: string;
  }>;
}> {
  const {
    organizationId,
    role,
    teamId: memberTeamId,
    userId,
  } = await requireOrganization();

  const { userScope, hasUserFilter } = buildUsageUserScope(
    organizationId,
    filters,
    await withReportAccess({ id: userId, role, teamId: memberTeamId })
  );
  const subscribedAppIds = await getSubscribedAppIds(
    organizationId,
    userScope,
    hasUserFilter
  );

  const report = await getUsageReport(filters);
  const appUsageAll = await getAppUsageRankingInternal(
    organizationId,
    userScope,
    subscribedAppIds
  );

  return {
    summary: report.summary,
    activeUsersTrend: report.activeUsersTrend,
    appUsage: appUsageAll.map((app) => ({
      appName: app.appName,
      userCount: app.userCount,
      usageRate: `${app.usageRate}%`,
    })),
    unusedApps: report.unusedApps.map((app) => ({
      appName: app.appName,
      lastUsedAt: app.lastUsedAt || "Never",
      licenseCount: app.licenseCount?.toString() || "-",
    })),
  };
}
