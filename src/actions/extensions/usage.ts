// src/actions/extensions/usage.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  DomainDetailData,
  LoginEventDetail,
  UsageAnalyticsData,
  UsageAnalyticsPeriod,
} from "@/types/extension";

/**
 * Extract the bare domain from a URL or domain string
 * e.g. "https://www.google.com/login" → "www.google.com"
 */
function extractDomain(urlOrDomain: string): string {
  try {
    // If it is a URL, extract the hostname
    if (urlOrDomain.includes("://")) {
      const url = new URL(urlOrDomain);
      return url.hostname;
    }
    // When a path is included (google.com/login)
    if (urlOrDomain.includes("/")) {
      return urlOrDomain.split("/")[0];
    }
    // Already a bare domain
    return urlOrDomain;
  } catch {
    return urlOrDomain;
  }
}

/**
 * Check whether a domain matches a whitelist pattern
 */
function matchesWhitelistPattern(domain: string, pattern: string): boolean {
  const extractedDomain = extractDomain(domain);
  const domainLower = extractedDomain.toLowerCase();
  const patternLower = pattern.toLowerCase();

  // Wildcard pattern (*.example.com)
  if (patternLower.startsWith("*.")) {
    const suffix = patternLower.slice(2);
    return domainLower === suffix || domainLower.endsWith("." + suffix);
  }

  // Exact match
  return domainLower === patternLower;
}

/**
 * Fetch the organization's active whitelist patterns
 */
async function getEnabledWhitelistPatterns(
  organizationId: string
): Promise<string[]> {
  const whitelists = await prisma.extensionWhitelist.findMany({
    where: {
      organizationId,
      enabled: true,
    },
    select: {
      pattern: true,
    },
  });

  return whitelists.map((w) => w.pattern);
}

/**
 * Check whether a domain is on the whitelist
 */
function isDomainWhitelisted(domain: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesWhitelistPattern(domain, pattern));
}

/**
 * Fetch usage analytics data (login-based, whitelist-filtered)
 */
export async function getUsageAnalytics(
  period: UsageAnalyticsPeriod = "today"
): Promise<ActionState<UsageAnalyticsData>> {
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

    const organizationId = session.user.organizationId;

    // Compute the period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Fetch whitelist patterns
    const whitelistPatterns = await getEnabledWhitelistPatterns(organizationId);

    // Fetch login events
    const loginEvents = await prisma.extensionLoginEvent.findMany({
      where: {
        organizationId,
        capturedAt: { gte: startDate },
      },
      select: {
        id: true,
        domain: true,
        username: true,
        deviceId: true,
      },
    });

    // Whitelist filtering
    const filteredEvents = loginEvents.filter((event) =>
      isDomainWhitelisted(event.domain, whitelistPatterns)
    );

    // Aggregate by domain
    const domainStats = new Map<
      string,
      { loginCount: number; users: Set<string>; devices: Set<string> }
    >();

    for (const event of filteredEvents) {
      const existing = domainStats.get(event.domain) || {
        loginCount: 0,
        users: new Set<string>(),
        devices: new Set<string>(),
      };

      existing.loginCount++;
      existing.users.add(event.username);
      existing.devices.add(event.deviceId);

      domainStats.set(event.domain, existing);
    }

    // Sort and transform
    const topDomains = Array.from(domainStats.entries())
      .map(([domain, stats]) => ({
        domain,
        loginCount: stats.loginCount,
        uniqueUsers: stats.users.size,
        uniqueDevices: stats.devices.size,
      }))
      .sort((a, b) => b.loginCount - a.loginCount)
      .slice(0, 20);

    // Overall statistics
    const allUsers = new Set<string>();
    const allDevices = new Set<string>();

    for (const event of filteredEvents) {
      allUsers.add(event.username);
      allDevices.add(event.deviceId);
    }

    return {
      success: true,
      data: {
        period,
        totalLogins: filteredEvents.length,
        uniqueUsers: allUsers.size,
        uniqueDevices: allDevices.size,
        topDomains,
      },
    };
  } catch (error) {
    console.error("[getUsageAnalytics] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch usage analytics",
    };
  }
}

/**
 * Fetch login event details per domain
 */
export async function getDomainLoginEvents(
  domain: string,
  date: string
): Promise<ActionState<DomainDetailData>> {
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

    const organizationId = session.user.organizationId;

    // Parse the date (YYYY-MM-DD)
    const targetDate = new Date(date);
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate() + 1
    );

    // Whitelist check
    const whitelistPatterns = await getEnabledWhitelistPatterns(organizationId);
    if (!isDomainWhitelisted(domain, whitelistPatterns)) {
      return {
        success: false,
        error: "This domain is not on the whitelist",
      };
    }

    // Fetch login events (with User join)
    const events = await prisma.extensionLoginEvent.findMany({
      where: {
        organizationId,
        domain,
        capturedAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: {
        capturedAt: "desc",
      },
      take: 200,
    });

    // Compute statistics
    const users = new Set<string>();
    const devices = new Set<string>();

    for (const event of events) {
      users.add(event.username);
      devices.add(event.deviceId);
    }

    const eventDetails: LoginEventDetail[] = events.map((e) => ({
      id: e.id,
      domain: e.domain,
      username: e.username,
      userName: e.user?.name ?? null,
      userEmail: e.user?.email ?? null,
      authType: e.authType,
      capturedAt: e.capturedAt,
      deviceId: e.deviceId,
    }));

    return {
      success: true,
      data: {
        domain,
        loginCount: events.length,
        uniqueUsers: users.size,
        uniqueDevices: devices.size,
        events: eventDetails,
      },
    };
  } catch (error) {
    console.error("[getDomainLoginEvents] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to fetch login events",
    };
  }
}
