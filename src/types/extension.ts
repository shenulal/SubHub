// src/types/extension.ts
// Extension TypeScript types and Zod validation schemas

import type { Prisma } from "@prisma/client";
import { z } from "zod";

// ==================== Whitelist Types ====================

/**
 * Extension whitelist entry
 */
export type ExtensionWhitelistItem = Prisma.ExtensionWhitelistGetPayload<{
  select: {
    id: true;
    organizationId: true;
    pattern: true;
    name: true;
    enabled: true;
    source: true;
    addedAt: true;
    updatedAt: true;
  };
}>;

/**
 * Extension whitelist detail (currently the same as Item)
 */
export type ExtensionWhitelistDetail = ExtensionWhitelistItem;

/**
 * Whitelist create input
 */
export type CreateWhitelistInput = {
  pattern: string;
  name: string;
  source?: "MANUAL" | "GOOGLE_SYNC" | "ADMIN_IMPORT";
};

/**
 * Whitelist update input
 */
export type UpdateWhitelistInput = Partial<CreateWhitelistInput> & {
  enabled?: boolean;
};

// ==================== Blacklist Types ====================

/**
 * Extension blacklist entry
 */
export type ExtensionBlacklistItem = Prisma.ExtensionBlacklistGetPayload<{
  select: {
    id: true;
    organizationId: true;
    pattern: true;
    name: true;
    reason: true;
    enabled: true;
    addedAt: true;
    updatedAt: true;
  };
}>;

/**
 * Extension blacklist detail (currently the same as Item)
 */
export type ExtensionBlacklistDetail = ExtensionBlacklistItem;

/**
 * Blacklist create input
 */
export type CreateBlacklistInput = {
  pattern: string;
  name: string;
  reason?: string;
};

/**
 * Blacklist update input
 */
export type UpdateBlacklistInput = Partial<CreateBlacklistInput> & {
  enabled?: boolean;
};

// ==================== Config Types ====================

/**
 * Extension config entry
 */
export type ExtensionConfigItem = Prisma.ExtensionConfigGetPayload<{
  select: {
    id: true;
    organizationId: true;
    configKey: true;
    configValue: true;
    category: true;
    valueType: true;
    description: true;
    isActive: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

/**
 * Config update input
 */
export type UpdateConfigInput = {
  configKey: string;
  configValue: string;
};

// ==================== Build Types ====================

/**
 * Extension build entry
 */
export type ExtensionBuildItem = Prisma.ExtensionBuildGetPayload<{
  select: {
    id: true;
    organizationId: true;
    version: true;
    platform: true;
    status: true;
    serverUrl: true;
    downloadUrl: true;
    checksum: true;
    fileSize: true;
    buildLog: true;
    errorMessage: true;
    createdAt: true;
    completedAt: true;
  };
}>;

/**
 * Build trigger input
 */
export type TriggerBuildInput = {
  platform: "CHROME" | "WINDOWS_EXE" | "WINDOWS_MSI" | "MAC_PKG" | "MAC_DMG";
};

// ==================== Pagination Types ====================

/**
 * Paginated response
 */
export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Pagination parameters
 */
export type PaginationParams = {
  page?: number;
  limit?: number;
};

// ==================== Zod Schemas ====================

/**
 * Whitelist create input validation schema
 */
export const createWhitelistSchema = z.object({
  pattern: z.string().min(1, "Please enter a domain pattern").max(255),
  name: z.string().min(1, "Please enter a name").max(100),
  source: z.enum(["MANUAL", "GOOGLE_SYNC", "ADMIN_IMPORT"]).optional(),
});

/**
 * Whitelist update input validation schema
 */
export const updateWhitelistSchema = z.object({
  pattern: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Blacklist create input validation schema
 */
export const createBlacklistSchema = z.object({
  pattern: z.string().min(1, "Please enter a domain pattern").max(255),
  name: z.string().min(1, "Please enter a name").max(100),
  reason: z.string().max(500).optional(),
});

/**
 * Blacklist update input validation schema
 */
export const updateBlacklistSchema = z.object({
  pattern: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(100).optional(),
  reason: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Config update input validation schema
 */
export const updateConfigSchema = z.object({
  configKey: z.string().min(1),
  configValue: z.string().min(1),
});

/**
 * Build trigger input validation schema
 */
export const triggerBuildSchema = z.object({
  platform: z.enum([
    "CHROME",
    "WINDOWS_EXE",
    "WINDOWS_MSI",
    "MAC_PKG",
    "MAC_DMG",
  ]),
});

// ==================== Usage Types ====================

/**
 * Extension usage entry (for time tracking)
 */
export type ExtensionUsageItem = Prisma.ExtensionUsageGetPayload<{
  select: {
    id: true;
    organizationId: true;
    deviceId: true;
    domain: true;
    visitCount: true;
    totalSeconds: true;
    date: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

/**
 * Usage analytics period
 */
export type UsageAnalyticsPeriod = "today" | "week" | "month";

/**
 * Usage analytics per-domain data (login-based)
 */
export type DomainLoginItem = {
  domain: string;
  loginCount: number;
  uniqueUsers: number;
  uniqueDevices: number;
};

/**
 * Usage analytics data (login-based)
 */
export type UsageAnalyticsData = {
  period: UsageAnalyticsPeriod;
  totalLogins: number;
  uniqueUsers: number;
  uniqueDevices: number;
  topDomains: DomainLoginItem[];
};

/**
 * Login event detail (for per-domain lookup)
 */
export type LoginEventDetail = {
  id: string;
  domain: string;
  username: string;
  userName: string | null;
  userEmail: string | null;
  authType: "PASSWORD" | "MAGIC_LINK" | "OAUTH" | "SSO";
  capturedAt: Date;
  deviceId: string;
};

/**
 * Domain detail response
 */
export type DomainDetailData = {
  domain: string;
  loginCount: number;
  uniqueUsers: number;
  uniqueDevices: number;
  events: LoginEventDetail[];
};

// ==================== Device Types ====================

/**
 * Extension device entry
 */
export type ExtensionDeviceItem = Prisma.ExtensionDeviceGetPayload<{
  select: {
    id: true;
    organizationId: true;
    deviceKey: true;
    browserInfo: true;
    osInfo: true;
    extensionVersion: true;
    status: true;
    lastSeenAt: true;
    userId: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

/**
 * Extension device detail (including User)
 */
export type ExtensionDeviceDetail = Prisma.ExtensionDeviceGetPayload<{
  select: {
    id: true;
    organizationId: true;
    deviceKey: true;
    browserInfo: true;
    osInfo: true;
    extensionVersion: true;
    status: true;
    lastSeenAt: true;
    userId: true;
    createdAt: true;
    updatedAt: true;
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
  };
}>;

/**
 * Device status update input
 */
export type UpdateDeviceStatusInput = {
  status: "APPROVED" | "REVOKED";
};

/**
 * Device status update validation schema
 */
export const updateDeviceStatusSchema = z.object({
  status: z.enum(["APPROVED", "REVOKED"]),
});

// ==================== Dashboard Types ====================

/**
 * Sync status
 */
export type SyncStatusItem = {
  lastSync: Date | null;
  status: "success" | "error" | "pending";
};

/**
 * Extension dashboard statistics
 */
export type ExtensionDashboardStats = {
  activeDevices: number;
  inactiveDevices: number;
  blockedSitesCount: number;
  trackedSitesCount: number;
  totalUsageTimeToday: number;
  syncStatus: {
    blacklist: SyncStatusItem;
    whitelist: SyncStatusItem;
    usageData: SyncStatusItem;
  };
};
