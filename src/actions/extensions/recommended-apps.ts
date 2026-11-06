// src/actions/extensions/recommended-apps.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/service";
import { classifyMerchantWithLLM } from "@/lib/services/saas-classifier";
import {
  extractMainDomain,
  matchDomainPattern,
} from "@/lib/utils/domain-extractor";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Recommended app item type
 */
export type RecommendedAppItem = {
  id: string;
  domain: string;
  serviceName: string | null;
  category: string | null;
  confidence: number | null;
  website: string | null;
  visitCount: number;
  uniqueUsers: number;
  lastSeenAt: Date;
  scannedAt: Date;
};

/**
 * Recommended app list response type
 */
export type RecommendedAppsResponse = {
  items: RecommendedAppItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingScanCount: number;
};

/**
 * Fetch the recommended app list
 * - Unregistered domains identified as SaaS
 */
export async function getRecommendedApps(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<ActionState<RecommendedAppsResponse>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:read"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    const { page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    // Fetch scan history identified as SaaS (unregistered only)
    const whereClause = {
      organizationId: session.user.organizationId,
      isSaaS: true,
      ...(search && {
        OR: [
          { domain: { contains: search, mode: "insensitive" as const } },
          { serviceName: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [scanHistory, , pendingCount] = await Promise.all([
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
        orderBy: { scannedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.saaSDomainScanHistory.count({ where: whereClause }),
      getUnscannedDomainCount(session.user.organizationId),
    ]);

    // Fetch registered app patterns
    const registeredPatterns = await getRegisteredPatterns(
      session.user.organizationId
    );

    // Exclude registered apps
    const filteredHistory = scanHistory.filter((item) => {
      return !registeredPatterns.some((p) =>
        matchDomainPattern(p, item.domain)
      );
    });

    // Fetch visit statistics
    const domainStats = await getDomainVisitStats(
      session.user.organizationId,
      filteredHistory.map((h) => h.domain)
    );

    const items: RecommendedAppItem[] = filteredHistory.map((item) => {
      const stats = domainStats.get(item.domain);
      return {
        id: item.id,
        domain: item.domain,
        serviceName: item.serviceName || item.catalog?.name || null,
        category: item.category || item.catalog?.category || null,
        confidence: item.confidence,
        website:
          item.website || item.catalog?.website || `https://${item.domain}`,
        visitCount: stats?.visitCount || 0,
        uniqueUsers: stats?.uniqueUsers || 0,
        lastSeenAt: stats?.lastSeenAt || item.scannedAt,
        scannedAt: item.scannedAt,
      };
    });

    return {
      success: true,
      data: {
        items,
        total: filteredHistory.length,
        page,
        limit,
        totalPages: Math.ceil(filteredHistory.length / limit),
        pendingScanCount: pendingCount,
      },
    };
  } catch (error) {
    console.error("[getRecommendedApps] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch recommended apps",
    };
  }
}

/**
 * Scan unscanned domains
 * - Extracts unregistered/unscanned domains from access logs and classifies whether they are SaaS
 */
export async function scanUnregisteredDomains(params: {
  batchSize?: number;
}): Promise<ActionState<{ scanned: number; saasFound: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    const { batchSize = 10 } = params;

    // Extract unscanned domains
    const unscannedDomains = await getUnscannedDomains(
      session.user.organizationId,
      batchSize
    );

    if (unscannedDomains.length === 0) {
      return {
        success: true,
        data: { scanned: 0, saasFound: 0 },
        message: "No new domains to scan.",
      };
    }

    let saasFound = 0;

    // Classify each domain as SaaS or not
    for (const domain of unscannedDomains) {
      try {
        const result = await classifyMerchantWithLLM({
          merchantName: domain,
          memo: `Website domain: ${domain}`,
        });

        const inference = result.inference;

        // Save the scan result
        await prisma.saaSDomainScanHistory.create({
          data: {
            organizationId: session.user.organizationId,
            domain,
            isSaaS: inference?.isSaaS ?? false,
            serviceName: inference?.canonicalName,
            category: inference?.category,
            confidence: inference?.confidence,
            website: inference?.website || `https://${domain}`,
            reasoning: inference?.reasoning,
          },
        });

        if (inference?.isSaaS) {
          saasFound++;
        }
      } catch (error) {
        console.error(
          `[scanUnregisteredDomains] Error scanning ${domain}:`,
          error
        );
        // On error, still save as non-SaaS to avoid rescanning
        await prisma.saaSDomainScanHistory.create({
          data: {
            organizationId: session.user.organizationId,
            domain,
            isSaaS: false,
            reasoning: "Scan failed",
          },
        });
      }
    }

    revalidatePath("/extensions/recommended-apps");

    return {
      success: true,
      data: {
        scanned: unscannedDomains.length,
        saasFound,
      },
      message: `Scanned ${unscannedDomains.length} domains, found ${saasFound} SaaS`,
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
 * Add a recommended app as a registered app
 */
export async function registerRecommendedApp(
  scanHistoryId: string
): Promise<ActionState<{ appId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
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
      return { success: false, error: "Recommended app not found" };
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

    revalidatePath("/extensions/recommended-apps");
    revalidatePath("/extensions/registered-apps");
    revalidatePath("/apps");

    return {
      success: true,
      data: { appId: app.id },
      message: "App registered",
    };
  } catch (error) {
    console.error("[registerRecommendedApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

/**
 * Ignore a recommended app (mark as non-SaaS)
 */
export async function dismissRecommendedApp(
  scanHistoryId: string
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("extensions:manage"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    // Set isSaaS to false in scan history
    await prisma.saaSDomainScanHistory.update({
      where: { id: scanHistoryId },
      data: { isSaaS: false, reasoning: "Dismissed by user" },
    });

    revalidatePath("/extensions/recommended-apps");

    return { success: true, message: "Ignored" };
  } catch (error) {
    console.error("[dismissRecommendedApp] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Processing failed",
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
  // Extract unique domains from the last 30 days of browsing logs
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

  // Exclude domains that were already scanned
  const scannedDomains = await prisma.saaSDomainScanHistory.findMany({
    where: { organizationId },
    select: { domain: true },
  });
  const scannedSet = new Set(scannedDomains.map((s) => s.domain));

  // Fetch registered app patterns
  const registeredPatterns = await getRegisteredPatterns(organizationId);

  let unscannedCount = 0;
  for (const domain of mainDomains) {
    if (scannedSet.has(domain)) continue;
    if (registeredPatterns.some((p) => matchDomainPattern(p, domain))) continue;
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

  // Sort browsing log domains by visit count
  const domainStats = await prisma.extensionBrowsingLog.groupBy({
    by: ["domain"],
    where: {
      organizationId,
      visitedAt: { gte: thirtyDaysAgo },
    },
    _count: { domain: true },
    orderBy: { _count: { domain: "desc" } },
    take: 500, // Check only the top 500 domains
  });

  // Extract the root domain
  const mainDomainCounts = new Map<string, number>();
  for (const stat of domainStats) {
    const mainDomain = extractMainDomain(stat.domain);
    if (mainDomain) {
      const current = mainDomainCounts.get(mainDomain) || 0;
      mainDomainCounts.set(mainDomain, current + stat._count.domain);
    }
  }

  // Exclude domains that were already scanned
  const scannedDomains = await prisma.saaSDomainScanHistory.findMany({
    where: { organizationId },
    select: { domain: true },
  });
  const scannedSet = new Set(scannedDomains.map((s) => s.domain));

  // Fetch registered app patterns
  const registeredPatterns = await getRegisteredPatterns(organizationId);

  // Filter and sort
  const unscannedDomains = Array.from(mainDomainCounts.entries())
    .filter(([domain]) => {
      if (scannedSet.has(domain)) return false;
      if (registeredPatterns.some((p) => matchDomainPattern(p, domain)))
        return false;
      return true;
    })
    .sort((a, b) => b[1] - a[1]) // Visit count, descending
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
