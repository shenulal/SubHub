// src/lib/services/notification/legacy-alerts.ts
/**
 * Legacy "computed" alerts inherited from the upstream base (renewals, offboarding,
 * shadow IT, cost anomalies, pending review). They are no longer rendered
 * directly: `backfillComputedAlerts()` converts them into persistent
 * `Notification` rows from the reminders cron.
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import {
  matchDomainPattern,
  matchDomainWithTldVariants,
} from "@/lib/utils/domain-extractor";

export type InAppNotificationType =
  | "renewal"
  | "offboarding"
  | "shadowIT"
  | "costAnomaly"
  | "pendingReview";

export interface InAppNotification {
  id: string;
  type: InAppNotificationType;
  title: string;
  detail: string;
  createdAt: Date;
  link: string;
}

/** Legacy flags still stored on `Organization.settings.notifications`. */
export interface LegacyNotificationFlags {
  renewalAlertDays: number[];
  offboardingAlerts: boolean;
  shadowITAlerts: boolean;
  costAnomalyAlerts: boolean;
}

const DEFAULT_LEGACY_FLAGS: LegacyNotificationFlags = {
  renewalAlertDays: [30],
  offboardingAlerts: true,
  shadowITAlerts: true,
  costAnomalyAlerts: true,
};

const MAX_LEGACY_ALERTS = 20;

export async function readLegacyFlags(
  organizationId: string
): Promise<LegacyNotificationFlags> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const raw =
    organization?.settings && typeof organization.settings === "object"
      ? ((organization.settings as Record<string, unknown>).notifications as
          | Partial<LegacyNotificationFlags>
          | undefined)
      : undefined;
  return { ...DEFAULT_LEGACY_FLAGS, ...(raw ?? {}) };
}

/**
 * Computes the legacy alert list for an organisation (no session required).
 */
export async function computeLegacyAlerts(
  organizationId: string
): Promise<InAppNotification[]> {
  const [flags, settings] = await Promise.all([
    readLegacyFlags(organizationId),
    getSettings(organizationId, ["discovery.costAnomalyThresholdPercent"]),
  ]);

  const queries: Promise<InAppNotification[]>[] = [];
  if (flags.renewalAlertDays.length > 0) {
    queries.push(fetchRenewalAlerts(organizationId, flags.renewalAlertDays));
  }
  if (flags.offboardingAlerts)
    queries.push(fetchOffboardingAlerts(organizationId));
  if (flags.shadowITAlerts) queries.push(fetchShadowITAlerts(organizationId));
  if (flags.costAnomalyAlerts) {
    queries.push(
      fetchCostAnomalyAlerts(
        organizationId,
        settings["discovery.costAnomalyThresholdPercent"]
      )
    );
  }
  queries.push(fetchPendingReviewAlerts(organizationId));

  const results = await Promise.all(queries);
  return results
    .flat()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, MAX_LEGACY_ALERTS);
}
// ─── 1) Subscription renewal alerts ──────────────────────────────────────────

async function fetchRenewalAlerts(
  organizationId: string,
  alertDays: number[]
): Promise<InAppNotification[]> {
  const now = new Date();
  const notifications: InAppNotification[] = [];

  for (const days of alertDays) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);

    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 1);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 1);

    const subscriptions = await prisma.subscription.findMany({
      where: {
        app: { organizationId },
        status: "ACTIVE",
        renewalDate: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        renewalDate: true,
        app: { select: { id: true, name: true } },
      },
      take: 5,
    });

    for (const sub of subscriptions) {
      const renewalDate = sub.renewalDate!;
      const daysLeft = Math.ceil(
        (renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      notifications.push({
        id: `renewal-${sub.id}-${days}`,
        type: "renewal",
        title: `D-${daysLeft} ${sub.app.name}`,
        detail: `${renewalDate.toLocaleDateString("en-US")}`,
        createdAt: now,
        link: `/apps/${sub.app.id}`,
      });
    }
  }

  return notifications;
}

// ─── 2) Offboarded users with unrevoked access ──────────────────────────────────────

async function fetchOffboardingAlerts(
  organizationId: string
): Promise<InAppNotification[]> {
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      status: "TERMINATED",
      appAccesses: { some: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { appAccesses: true } },
    },
    take: 5,
  });

  return users.map((user) => ({
    id: `offboard-${user.id}`,
    type: "offboarding" as const,
    title: user.name || user.email,
    detail: `${user._count.appAccesses}`,
    createdAt: new Date(),
    link: "/security",
  }));
}

// ─── 3) Shadow IT alerts ──────────────────────────────────────────

async function fetchShadowITAlerts(
  organizationId: string
): Promise<InAppNotification[]> {
  const [pendingScans, whitelistPatterns] = await Promise.all([
    prisma.saaSDomainScanHistory.findMany({
      where: {
        organizationId,
        reviewStatus: "pending",
        OR: [{ isMalicious: true }, { isSaaS: true }],
      },
      select: {
        id: true,
        domain: true,
        isMalicious: true,
        serviceName: true,
        scannedAt: true,
      },
      orderBy: { scannedAt: "desc" },
      take: 20,
    }),
    prisma.extensionWhitelist.findMany({
      where: { organizationId },
      select: { pattern: true },
    }),
  ]);

  // Whitelist filtering
  const registeredPatterns = whitelistPatterns.map((w) => w.pattern);
  const filtered = pendingScans.filter(
    (scan) =>
      !registeredPatterns.some(
        (p) =>
          matchDomainPattern(p, scan.domain) ||
          matchDomainWithTldVariants(p, scan.domain)
      )
  );

  return filtered.slice(0, 5).map((scan) => ({
    id: `shadow-${scan.id}`,
    type: "shadowIT" as const,
    title: scan.serviceName || scan.domain,
    detail: scan.isMalicious ? "malicious" : "saas",
    createdAt: scan.scannedAt,
    link: "/extensions/review-apps",
  }));
}

// ─── 4) Cost anomaly alerts ──────────────────────────────────────────

async function fetchCostAnomalyAlerts(
  organizationId: string,
  threshold: number
): Promise<InAppNotification[]> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [currentCosts, previousCosts] = await Promise.all([
    prisma.cardTransaction.groupBy({
      by: ["matchedAppId"],
      where: {
        organizationId,
        matchedAppId: { not: null },
        transactionType: "APPROVAL",
        createdAt: { gte: currentMonthStart },
      },
      _sum: { useAmt: true },
    }),
    prisma.cardTransaction.groupBy({
      by: ["matchedAppId"],
      where: {
        organizationId,
        matchedAppId: { not: null },
        transactionType: "APPROVAL",
        createdAt: { gte: previousMonthStart, lte: previousMonthEnd },
      },
      _sum: { useAmt: true },
    }),
  ]);

  const previousCostMap = new Map(
    previousCosts.map((c) => [c.matchedAppId, Number(c._sum.useAmt) || 0])
  );

  // Collect IDs of apps with anomalies
  const anomalyAppIds: string[] = [];
  const anomalyData = new Map<
    string,
    { currentCost: number; previousCost: number; pctChange: number }
  >();

  for (const current of currentCosts) {
    if (!current.matchedAppId) continue;
    const currentCost = Number(current._sum.useAmt) || 0;
    const previousCost = previousCostMap.get(current.matchedAppId) || 0;
    if (previousCost === 0) continue;

    const pctChange = ((currentCost - previousCost) / previousCost) * 100;
    if (pctChange >= threshold) {
      anomalyAppIds.push(current.matchedAppId);
      anomalyData.set(current.matchedAppId, {
        currentCost,
        previousCost,
        pctChange,
      });
    }
  }

  if (anomalyAppIds.length === 0) return [];

  // Look up app names
  const apps = await prisma.app.findMany({
    where: { id: { in: anomalyAppIds } },
    select: { id: true, name: true },
  });
  const appNameMap = new Map(apps.map((a) => [a.id, a.name]));

  return anomalyAppIds.slice(0, 5).map((appId) => {
    const data = anomalyData.get(appId)!;
    return {
      id: `cost-${appId}`,
      type: "costAnomaly" as const,
      title: appNameMap.get(appId) || appId,
      detail: `+${Math.round(data.pctChange)}%`,
      createdAt: new Date(),
      link: "/cost",
    };
  });
}

// ─── 5) Apps pending review (always on) ────────────────────────────────

async function fetchPendingReviewAlerts(
  organizationId: string
): Promise<InAppNotification[]> {
  const [pendingScans, whitelistPatterns] = await Promise.all([
    prisma.saaSDomainScanHistory.findMany({
      where: {
        organizationId,
        reviewStatus: "pending",
        OR: [{ isMalicious: true }, { isSaaS: true }],
      },
      select: {
        id: true,
        domain: true,
        isMalicious: true,
        serviceName: true,
        scannedAt: true,
      },
      orderBy: { scannedAt: "desc" },
    }),
    prisma.extensionWhitelist.findMany({
      where: { organizationId },
      select: { pattern: true },
    }),
  ]);

  const registeredPatterns = whitelistPatterns.map((w) => w.pattern);
  const filtered = pendingScans.filter(
    (scan) =>
      !registeredPatterns.some(
        (p) =>
          matchDomainPattern(p, scan.domain) ||
          matchDomainWithTldVariants(p, scan.domain)
      )
  );

  const malicious = filtered.filter((s) => s.isMalicious);
  const saas = filtered.filter((s) => !s.isMalicious);

  const notifications: InAppNotification[] = [];

  if (malicious.length > 0) {
    notifications.push({
      id: "pending-malicious",
      type: "pendingReview",
      title: `${malicious.length}`,
      detail: "malicious",
      createdAt: malicious[0].scannedAt,
      link: "/extensions/review-apps",
    });
  }

  if (saas.length > 0) {
    notifications.push({
      id: "pending-saas",
      type: "pendingReview",
      title: `${saas.length}`,
      detail: "saas",
      createdAt: saas.length > 0 ? saas[0].scannedAt : new Date(),
      link: "/extensions/review-apps",
    });
  }

  return notifications;
}
