// src/app/api/v1/extensions/config/sync/route.ts
/**
 * Extension Config Sync API
 * Fetch remote config (syncIntervals, features, filters)
 */

import { withExtensionAuth } from "@/lib/api/extension-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import type { RemoteConfigData } from "@/types/extension-api";
import { NextResponse } from "next/server";

// Default settings
const DEFAULT_CONFIG: RemoteConfigData = {
  version: "1.0.0",
  syncIntervals: {
    blacklist: 5, // 5 min
    whitelist: 5, // 5 min
    usage: 10, // 10 min
    config: 60, // 60 min
  },
  features: {
    timeTracking: true,
    blacklistBlocking: true,
    loginCapture: true,
    usernameFiltering: false,
  },
  filters: {
    usernameFilters: [],
  },
};

/**
 * POST /api/v1/extensions/config/sync
 * Fetch the organization's Extension settings
 */
export const POST = withLogging(
  "ext:config-sync",
  withExtensionAuth(async (_request, { auth }) => {
    // Fetch per-organization settings from the DB
    const configItems = await prisma.extensionConfig.findMany({
      where: {
        organizationId: auth.organizationId,
        isActive: true,
      },
      select: {
        configKey: true,
        configValue: true,
        category: true,
        valueType: true,
      },
    });

    // Copy defaults
    const config: RemoteConfigData = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Override with DB settings
    for (const item of configItems) {
      const value = parseConfigValue(item.configValue, item.valueType);

      switch (item.category) {
        case "SYNC_INTERVALS":
          if (item.configKey in config.syncIntervals) {
            (config.syncIntervals as Record<string, number>)[item.configKey] =
              value as number;
          }
          break;
        case "FEATURES":
          if (item.configKey in config.features) {
            (config.features as Record<string, boolean>)[item.configKey] =
              value as boolean;
          }
          break;
        case "FILTERS":
          if (item.configKey === "usernameFilters" && Array.isArray(value)) {
            config.filters.usernameFilters = value;
          }
          break;
        case "GENERAL":
          if (item.configKey === "version" && typeof value === "string") {
            config.version = value;
          }
          break;
      }
    }

    // Add the onboarding section (always enabled)
    config.onboarding = { enabled: true };

    return NextResponse.json({
      success: true,
      config,
    });
  })
);

/**
 * Parse setting values
 */
function parseConfigValue(
  value: string,
  valueType: string
): string | number | boolean | string[] {
  switch (valueType) {
    case "NUMBER":
      return parseInt(value, 10);
    case "BOOLEAN":
      return value.toLowerCase() === "true";
    case "JSON":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}
