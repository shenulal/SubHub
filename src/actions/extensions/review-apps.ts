// src/actions/extensions/review-apps.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  checkDomainSafety,
  getThreatTypeLabel,
  type ThreatType,
} from "@/lib/services/google-safe-browsing";
import { classifyMerchantWithLLM } from "@/lib/services/saas-classifier";
import {
  extractMainDomain,
  matchDomainPattern,
  matchDomainWithTldVariants,
} from "@/lib/utils/domain-extractor";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Pending-review app type
 */
export type ReviewAppType = "malicious" | "saas";

/**
 * Pending-review app item type
 */
export type ReviewAppItem = {
  id: string;
  domain: string;
  type: ReviewAppType;
  typeBadge: string;
  reason: string;
  serviceName: string | null;
  category: string | null;
  confidence: number | null;
  website: string | null;
  visitCount: number;
  uniqueUsers: number;
  lastSeenAt: Date;
  scannedAt: Date;
  threatType: ThreatType | null;
  reviewStatus: string;
};

/**
 * Pending-review app list response type
 */
export type ReviewAppsResponse = {
  items: ReviewAppItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingScanCount: number;
  stats: {
    maliciousCount: number;
    saasCount: number;
  };
};

/**
 * Fetch the pending-review app list
 * - Suspected malicious URLs plus unregistered domains identified as SaaS
 */
export async function getReviewApps(params: {
  page?: number;
  limit?: number;
  search?: string;
  filter?: "all" | "malicious" | "saas";
}): Promise<ActionState<ReviewAppsResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const { page = 1, limit = 20, search, filter = "all" } = params;
    const skip = (page - 1) * limit;

    // Build filter conditions
    const baseWhere = {
      organizationId: session.user.organizationId,
      reviewStatus: "pending",
      ...(search && {
        OR: [
          { domain: { contains: search, mode: "insensitive" as const } },
          { serviceName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    // Filter by type
    const whereClause =
      filter === "malicious"
        ? { ...baseWhere, isMalicious: true }
        : filter === "saas"
          ? { ...baseWhere, isSaaS: true, isMalicious: false }
          : { ...baseWhere, OR: [{ isMalicious: true }, { isSaaS: true }] };

    const [scanHistory, totalCount, pendingCount, allPendingScans] =
      await Promise.all([
        prisma.saaSDomainScanHistory.findMany({
          where: whereClause,
          include: {
            catalog: {
              select: {
                name: true,
                category: true,
                website: true,
              },
            },
          },
          orderBy: [{ isMalicious: "desc" }, { scannedAt: "desc" }],
          skip,
          take: limit,
        }),
        prisma.saaSDomainScanHistory.count({ where: whereClause }),
        getUnscannedDomainCount(session.user.organizationId),
        // For stats: fetch all pending scans (exact counts after filtering)
        prisma.saaSDomainScanHistory.findMany({
          where: {
            organizationId: session.user.organizationId,
            reviewStatus: "pending",
            OR: [{ isMalicious: true }, { isSaaS: true }],
          },
          select: { domain: true, isMalicious: true, isSaaS: true },
        }),
      ]);

    // Fetch registered app patterns
    const registeredPatterns = await getRegisteredPatterns(
      session.user.organizationId
    );

    const isRegisteredDomain = (domain: string) =>
      registeredPatterns.some(
        (p) =>
          matchDomainPattern(p, domain) || matchDomainWithTldVariants(p, domain)
      );

    // Exclude registered apps (TLD variants also match)
    const filteredHistory = scanHistory.filter(
      (item) => !isRegisteredDomain(item.domain)
    );

    // stats: exact counts after filtering
    const filteredAllPending = allPendingScans.filter(
      (item) => !isRegisteredDomain(item.domain)
    );
    const maliciousCount = filteredAllPending.filter(
      (i) => i.isMalicious
    ).length;
    const saasCount = filteredAllPending.filter(
      (i) => i.isSaaS && !i.isMalicious
    ).length;

    // Fetch visit statistics
    const domainStats = await getDomainVisitStats(
      session.user.organizationId,
      filteredHistory.map((h) => h.domain)
    );

    const items: ReviewAppItem[] = filteredHistory.map((item) => {
      const stats = domainStats.get(item.domain);
      const isMalicious = item.isMalicious;

      return {
        id: item.id,
        domain: item.domain,
        type: isMalicious ? "malicious" : "saas",
        typeBadge: isMalicious ? "Suspected malicious" : "SaaS",
        reason: isMalicious
          ? getThreatTypeLabel(item.threatType as ThreatType)
          : item.reasoning || "AI classification result",
        serviceName: item.serviceName || item.catalog?.name || null,
        category: item.category || item.catalog?.category || null,
        confidence: item.confidence,
        website:
          item.website || item.catalog?.website || `https://${item.domain}`,
        visitCount: stats?.visitCount || 0,
        uniqueUsers: stats?.uniqueUsers || 0,
        lastSeenAt: stats?.lastSeenAt || item.scannedAt,
        scannedAt: item.scannedAt,
        threatType: item.threatType as ThreatType | null,
        reviewStatus: item.reviewStatus,
      };
    });

    return {
      success: true,
      data: {
        items,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        pendingScanCount: pendingCount,
        stats: {
          maliciousCount,
          saasCount,
        },
      },
    };
  } catch (error) {
    console.error("[getReviewApps] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch apps pending review",
    };
  }
}

/**
 * Scan unscanned domains
 * - Extracts unregistered/unscanned domains from access logs
 * - Classifies SaaS with the LLM and checks for malware with Google Safe Browsing
 */
export async function scanUnregisteredDomains(params: {
  batchSize?: number;
  organizationId?: string;
}): Promise<
  ActionState<{ scanned: number; saasFound: number; maliciousFound: number }>
> {
  try {
    let orgId = params.organizationId;

    if (!orgId) {
      const session = await auth();
      if (!session?.user?.organizationId) {
        return { success: false, error: "Authentication required" };
      }
      orgId = session.user.organizationId;
    }

    const { batchSize = 10 } = params;

    // Extract unscanned domains
    const unscannedDomains = await getUnscannedDomains(orgId, batchSize);

    if (unscannedDomains.length === 0) {
      return {
        success: true,
        data: { scanned: 0, saasFound: 0, maliciousFound: 0 },
        message: "No new domains to scan.",
      };
    }

    let saasFound = 0;
    let maliciousFound = 0;

    // Classify each domain as SaaS and check it for malware
    for (const domain of unscannedDomains) {
      try {
        // 1. Malware check via the Google Safe Browsing API
        const safetyResult = await checkDomainSafety(domain);

        // 2. SaaS classification via the LLM
        const classifyResult = await classifyMerchantWithLLM({
          merchantName: domain,
          memo: `Website domain: ${domain}`,
        });

        const inference = classifyResult.inference;

        // Save the scan result
        await prisma.saaSDomainScanHistory.create({
          data: {
            organizationId: orgId,
            domain,
            isSaaS: inference?.isSaaS ?? false,
            serviceName: inference?.canonicalName,
            category: inference?.category,
            confidence: inference?.confidence,
            website: inference?.website || `https://${domain}`,
            reasoning: inference?.reasoning,
            // Malware check result
            isMalicious: safetyResult.isMalicious,
            threatType: safetyResult.threatType,
            safeBrowsingCheckedAt: new Date(),
            reviewStatus: "pending",
          },
        });

        if (inference?.isSaaS) {
          saasFound++;
        }
        if (safetyResult.isMalicious) {
          maliciousFound++;
        }
      } catch (error) {
        console.error(
          `[scanUnregisteredDomains] Error scanning ${domain}:`,
          error
        );
        // On error, still save to avoid rescanning
        await prisma.saaSDomainScanHistory.create({
          data: {
            organizationId: orgId,
            domain,
            isSaaS: false,
            isMalicious: false,
            reasoning: "Scan failed",
            reviewStatus: "pending",
          },
        });
      }
    }

    revalidatePath("/extensions/review-apps");

    return {
      success: true,
      data: {
        scanned: unscannedDomains.length,
        saasFound,
        maliciousFound,
      },
      message: `Scanned ${unscannedDomains.length} domains (SaaS: ${saasFound}, malicious: ${maliciousFound})`,
    };
  } catch (error) {
    console.error("[scanUnregisteredDomains] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Scan failed",
    };
  }
}

/**
 * Add a pending-review app as a registered app
 */
export async function registerReviewApp(
  scanHistoryId: string
): Promise<ActionState<{ appId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Fetch scan history
    const scanHistory = await prisma.saaSDomainScanHistory.findUnique({
      where: { id: scanHistoryId },
      include: { catalog: true },
    });

    if (
      !scanHistory ||
      scanHistory.organizationId !== session.user.organizationId
    ) {
      return { success: false, error: "App pending review not found" };
    }

    // Create the app
    const app = await prisma.app.create({
      data: {
        organizationId: session.user.organizationId,
        name: scanHistory.serviceName || scanHistory.domain,
        customWebsite: scanHistory.website || `https://${scanHistory.domain}`,
        category: scanHistory.category,
        catalogId: scanHistory.catalogId,
        source: "MANUAL",
        status: "ACTIVE",
      },
    });

    // Add to the whitelist
    const pattern = `*.${scanHistory.domain}`;
    await prisma.extensionWhitelist.upsert({
      where: {
        organizationId_pattern: {
          organizationId: session.user.organizationId,
          pattern,
        },
      },
      update: { enabled: true },
      create: {
        organizationId: session.user.organizationId,
        pattern,
        name: app.name,
        source: "ADMIN_IMPORT",
        enabled: true,
      },
    });

    // Update the review status
    await prisma.saaSDomainScanHistory.update({
      where: { id: scanHistoryId },
      data: { reviewStatus: "registered" },
    });

    revalidatePath("/extensions/review-apps");
    revalidatePath("/extensions/registered-apps");
    revalidatePath("/apps");

    return {
      success: true,
      data: { appId: app.id },
      message: "App registered",
    };
  } catch (error) {
    console.error("[registerReviewApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

/**
 * Block a pending-review app
 */
export async function blockReviewApp(
  scanHistoryId: string,
  blockReason?: string
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Fetch scan history
    const scanHistory = await prisma.saaSDomainScanHistory.findUnique({
      where: { id: scanHistoryId },
    });

    if (
      !scanHistory ||
      scanHistory.organizationId !== session.user.organizationId
    ) {
      return { success: false, error: "App pending review not found" };
    }

    // Add to the blacklist
    const pattern = `*.${scanHistory.domain}`;
    const reason =
      blockReason ||
      (scanHistory.isMalicious
        ? `Malicious URL detected: ${getThreatTypeLabel(scanHistory.threatType as ThreatType)}`
        : "Blocked by an admin");

    await prisma.extensionBlacklist.upsert({
      where: {
        organizationId_pattern: {
          organizationId: session.user.organizationId,
          pattern,
        },
      },
      update: { enabled: true, reason },
      create: {
        organizationId: session.user.organizationId,
        pattern,
        name: scanHistory.serviceName || scanHistory.domain,
        reason,
        enabled: true,
      },
    });

    // Update the review status
    await prisma.saaSDomainScanHistory.update({
      where: { id: scanHistoryId },
      data: { reviewStatus: "blocked" },
    });

    revalidatePath("/extensions/review-apps");
    revalidatePath("/extensions/blocked-apps");
    revalidatePath("/extensions/blacklist");

    return { success: true, message: "Blocked" };
  } catch (error) {
    console.error("[blockReviewApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to block",
    };
  }
}

/**
 * Ignore a pending-review app (mark as non-SaaS)
 */
export async function dismissReviewApp(
  scanHistoryId: string
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    // Mark as reviewed in scan history
    await prisma.saaSDomainScanHistory.update({
      where: { id: scanHistoryId },
      data: {
        isSaaS: false,
        isMalicious: false,
        reviewStatus: "dismissed",
        reasoning: "Dismissed by user",
      },
    });

    revalidatePath("/extensions/review-apps");

    return { success: true, message: "Ignored" };
  } catch (error) {
    console.error("[dismissReviewApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Processing failed",
    };
  }
}

/**
 * Bulk register
 */
export async function bulkRegisterReviewApps(
  scanHistoryIds: string[]
): Promise<ActionState<{ registered: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    let registered = 0;

    for (const id of scanHistoryIds) {
      const result = await registerReviewApp(id);
      if (result.success) {
        registered++;
      }
    }

    return {
      success: true,
      data: { registered },
      message: `${registered} apps registered`,
    };
  } catch (error) {
    console.error("[bulkRegisterReviewApps] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Bulk registration failed",
    };
  }
}

/**
 * Bulk block
 */
export async function bulkBlockReviewApps(
  scanHistoryIds: string[],
  blockReason?: string
): Promise<ActionState<{ blocked: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    let blocked = 0;

    for (const id of scanHistoryIds) {
      const result = await blockReviewApp(id, blockReason);
      if (result.success) {
        blocked++;
      }
    }

    return {
      success: true,
      data: { blocked },
      message: `${blocked} apps blocked`,
    };
  } catch (error) {
    console.error("[bulkBlockReviewApps] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bulk block failed",
    };
  }
}

/**
 * Fetch the automatic scan schedule status
 */
export async function getScanScheduleStatus(): Promise<
  ActionState<{
    totalScannedCount: number;
    pendingScanCount: number;
    lastScanAt: Date | null;
    nextScanAt: Date;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }

    const orgId = session.user.organizationId;

    const [totalScannedCount, pendingScanCount, lastScanRecord] =
      await Promise.all([
        prisma.saaSDomainScanHistory.count({
          where: { organizationId: orgId },
        }),
        getUnscannedDomainCount(orgId),
        prisma.saaSDomainScanHistory.findFirst({
          where: { organizationId: orgId },
          orderBy: { scannedAt: "desc" },
          select: { scannedAt: true },
        }),
      ]);

    // Compute the next 3:00 AM UTC
    const now = new Date();
    const nextScanAt = new Date(now);
    nextScanAt.setUTCHours(3, 0, 0, 0);
    if (nextScanAt <= now) {
      nextScanAt.setUTCDate(nextScanAt.getUTCDate() + 1);
    }

    return {
      success: true,
      data: {
        totalScannedCount,
        pendingScanCount,
        lastScanAt: lastScanRecord?.scannedAt ?? null,
        nextScanAt,
      },
    };
  } catch (error) {
    console.error("[getScanScheduleStatus] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch the scan schedule status",
    };
  }
}

// ==================== Helper Functions ====================

/**
 * Fetch registered app patterns
 */
async function getRegisteredPatterns(
  organizationId: string
): Promise<string[]> {
  const whitelists = await prisma.extensionWhitelist.findMany({
    where: { organizationId },
    select: { pattern: true },
  });
  return whitelists.map((w) => w.pattern);
}

/**
 * Count unscanned domains
 */
async function getUnscannedDomainCount(
  organizationId: string
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const browsingLogs = await prisma.extensionBrowsingLog.findMany({
    where: {
      organizationId,
      visitedAt: { gte: thirtyDaysAgo },
    },
    select: { domain: true },
    distinct: ["domain"],
  });

  const mainDomains = new Set<string>();
  for (const log of browsingLogs) {
    const mainDomain = extractMainDomain(log.domain);
    if (mainDomain) {
      mainDomains.add(mainDomain);
    }
  }

  const scannedDomains = await prisma.saaSDomainScanHistory.findMany({
    where: { organizationId },
    select: { domain: true },
  });
  const scannedSet = new Set(scannedDomains.map((s) => s.domain));

  const registeredPatterns = await getRegisteredPatterns(organizationId);

  let unscannedCount = 0;
  for (const domain of mainDomains) {
    if (scannedSet.has(domain)) continue;
    if (
      registeredPatterns.some(
        (p) =>
          matchDomainPattern(p, domain) || matchDomainWithTldVariants(p, domain)
      )
    )
      continue;
    unscannedCount++;
  }

  return unscannedCount;
}

/**
 * Fetch unscanned domains
 */
async function getUnscannedDomains(
  organizationId: string,
  limit: number
): Promise<string[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const domainStats = await prisma.extensionBrowsingLog.groupBy({
    by: ["domain"],
    where: {
      organizationId,
      visitedAt: { gte: thirtyDaysAgo },
    },
    _count: { domain: true },
    orderBy: { _count: { domain: "desc" } },
    take: 500,
  });

  const mainDomainCounts = new Map<string, number>();
  for (const stat of domainStats) {
    const mainDomain = extractMainDomain(stat.domain);
    if (mainDomain) {
      const current = mainDomainCounts.get(mainDomain) || 0;
      mainDomainCounts.set(mainDomain, current + stat._count.domain);
    }
  }

  const scannedDomains = await prisma.saaSDomainScanHistory.findMany({
    where: { organizationId },
    select: { domain: true },
  });
  const scannedSet = new Set(scannedDomains.map((s) => s.domain));

  const registeredPatterns = await getRegisteredPatterns(organizationId);

  const unscannedDomains = Array.from(mainDomainCounts.entries())
    .filter(([domain]) => {
      if (scannedSet.has(domain)) return false;
      if (
        registeredPatterns.some(
          (p) =>
            matchDomainPattern(p, domain) ||
            matchDomainWithTldVariants(p, domain)
        )
      )
        return false;
      return true;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain]) => domain);

  return unscannedDomains;
}

/**
 * Fetch visit statistics per domain
 */
async function getDomainVisitStats(
  organizationId: string,
  domains: string[]
): Promise<
  Map<string, { visitCount: number; uniqueUsers: number; lastSeenAt: Date }>
> {
  const stats = new Map<
    string,
    { visitCount: number; uniqueUsers: number; lastSeenAt: Date }
  >();

  if (domains.length === 0) return stats;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const domain of domains) {
    const [visitStats, userStats, lastLog] = await Promise.all([
      prisma.extensionBrowsingLog.count({
        where: {
          organizationId,
          domain: { contains: domain },
          visitedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.extensionBrowsingLog.groupBy({
        by: ["userId"],
        where: {
          organizationId,
          domain: { contains: domain },
          visitedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.extensionBrowsingLog.findFirst({
        where: {
          organizationId,
          domain: { contains: domain },
        },
        orderBy: { visitedAt: "desc" },
        select: { visitedAt: true },
      }),
    ]);

    stats.set(domain, {
      visitCount: visitStats,
      uniqueUsers: userStats.length,
      lastSeenAt: lastLog?.visitedAt || new Date(),
    });
  }

  return stats;
}
