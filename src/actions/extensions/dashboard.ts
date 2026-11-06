// src/actions/extensions/dashboard.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { ExtensionDashboardStats } from "@/types/extension";

/**
 * Fetch extension dashboard statistics
 */
export async function getExtensionDashboard(): Promise<
  ActionState<ExtensionDashboardStats>
> {
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Device statistics
    const [activeDevices, inactiveDevices] = await Promise.all([
      prisma.extensionDevice.count({
        where: {
          organizationId,
          status: "APPROVED",
        },
      }),
      prisma.extensionDevice.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "REVOKED", "INACTIVE"] },
        },
      }),
    ]);

    // Blacklist/whitelist counts
    const [blockedSitesCount, trackedSitesCount] = await Promise.all([
      prisma.extensionBlacklist.count({
        where: {
          organizationId,
          enabled: true,
        },
      }),
      prisma.extensionWhitelist.count({
        where: {
          organizationId,
          enabled: true,
        },
      }),
    ]);

    // Total usage time today
    const usageToday = await prisma.extensionUsage.aggregate({
      where: {
        organizationId,
        date: { gte: today },
      },
      _sum: {
        totalSeconds: true,
      },
    });

    // Latest sync status (from ExtensionConfig)
    const syncConfigs = await prisma.extensionConfig.findMany({
      where: {
        organizationId,
        configKey: {
          in: ["blacklist_last_sync", "whitelist_last_sync", "usage_last_sync"],
        },
      },
    });

    const getSyncStatus = (key: string) => {
      const config = syncConfigs.find((c) => c.configKey === key);
      if (!config) {
        return { lastSync: null, status: "pending" as const };
      }
      const lastSync = new Date(config.configValue);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return {
        lastSync,
        status:
          lastSync > hourAgo ? ("success" as const) : ("pending" as const),
      };
    };

    return {
      success: true,
      data: {
        activeDevices,
        inactiveDevices,
        blockedSitesCount,
        trackedSitesCount,
        totalUsageTimeToday: usageToday._sum.totalSeconds || 0,
        syncStatus: {
          blacklist: getSyncStatus("blacklist_last_sync"),
          whitelist: getSyncStatus("whitelist_last_sync"),
          usageData: getSyncStatus("usage_last_sync"),
        },
      },
    };
  } catch (error) {
    console.error("[getExtensionDashboard] Error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch dashboard statistics",
    };
  }
}
