// src/types/extension-api.ts
// Extension API request/response types and Zod validation schemas

import { z } from "zod";

// ==================== Common Response Types ====================

/**
 * Extension API base response
 */
export type ExtensionApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: number;
};

// ==================== Health Check ====================

export type HealthCheckResponse = ExtensionApiResponse<{
  status: "ok";
  timestamp: number;
}>;

// ==================== Login Capture ====================

/**
 * Login capture request
 */
export type LoginCaptureRequest = {
  device_id: string;
  domain: string;
  username: string;
  password_hash: string; // SHA-512 hash
  auth_type?: "PASSWORD" | "MAGIC_LINK" | "OAUTH" | "SSO";
  captured_at: number; // Unix timestamp (ms)
};

/**
 * Login capture response
 */
export type LoginCaptureResponse = ExtensionApiResponse<{
  id: string;
  hibp?: {
    checked: boolean;
    breached: boolean;
    breach_count?: number;
  };
}>;

export const loginCaptureSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  domain: z.string().min(1, "domain is required"),
  username: z.string().min(1, "username is required"),
  password_hash: z
    .string()
    .min(64, "password_hash must be SHA-512 (128 chars)"),
  auth_type: z
    .enum(["PASSWORD", "MAGIC_LINK", "OAUTH", "SSO"])
    .optional()
    .default("PASSWORD"),
  captured_at: z.number().int().positive(),
});

// ==================== Usage Sync ====================

/**
 * Usage per domain
 */
export type UsageDomainData = {
  domain: string;
  totalSeconds: number;
  sessions: Array<{
    startTime: number;
    endTime?: number;
    duration: number;
  }>;
};

/**
 * Daily usage
 */
export type DailyUsageData = {
  date: string; // YYYY-MM-DD
  domains: Record<string, UsageDomainData>;
  totalSeconds: number;
};

/**
 * Usage Sync request
 */
export type UsageSyncRequest = {
  deviceId: string;
  dailyUsage: DailyUsageData[];
  syncTimestamp: number;
};

/**
 * Usage Sync response
 */
export type UsageSyncResponse = ExtensionApiResponse<{
  syncedCount: number;
  syncedAt: number;
}>;

export const usageSyncSchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  userId: z.string().optional(),
  dailyUsage: z.array(
    z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD format"),
      domains: z.record(
        z.string(),
        z.object({
          domain: z.string(),
          totalSeconds: z.number().int().min(0),
          sessions: z.array(
            z.object({
              startTime: z.number(),
              endTime: z.number().optional(),
              duration: z.number().min(0),
            })
          ),
        })
      ),
      totalSeconds: z.number().int().min(0),
    })
  ),
  syncTimestamp: z.number().int().positive(),
});

// ==================== Whitelist Sync ====================

/**
 * Whitelist domain entry
 */
export type WhitelistDomainItem = {
  pattern: string;
  name: string;
  enabled: boolean;
  source?: "default" | "user" | "backend";
};

/**
 * Whitelist Sync GET response
 */
export type WhitelistSyncGetResponse = ExtensionApiResponse<{
  whitelist: Array<{
    pattern: string;
    name: string;
    enabled: boolean;
  }>;
}>;

/**
 * Whitelist Sync POST request
 */
export type WhitelistSyncPostRequest = {
  device_id: string;
  whitelist: WhitelistDomainItem[];
};

/**
 * Whitelist Sync POST response
 */
export type WhitelistSyncPostResponse = ExtensionApiResponse<{
  syncedCount: number;
}>;

export const whitelistSyncPostSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  whitelist: z.array(
    z.object({
      pattern: z.string().min(1),
      name: z.string().min(1),
      enabled: z.boolean(),
      source: z.enum(["default", "user", "backend"]).optional(),
    })
  ),
});

// ==================== Blacklist Sync ====================

/**
 * Blacklist Sync GET response
 */
export type BlacklistSyncResponse = ExtensionApiResponse<{
  blacklist: Array<{
    pattern: string;
    name: string;
    reason?: string;
    enabled: boolean;
  }>;
  version?: string;
}>;

// ==================== Config Sync ====================

/**
 * Remote Config
 */
export type RemoteConfigData = {
  version: string;
  syncIntervals: {
    blacklist: number; // in minutes
    whitelist: number;
    usage: number;
    config: number;
  };
  features: {
    timeTracking: boolean;
    blacklistBlocking: boolean;
    loginCapture: boolean;
    usernameFiltering: boolean;
  };
  filters: {
    usernameFilters: string[];
  };
  onboarding?: {
    enabled: boolean;
  };
};

/**
 * Config Sync response
 */
export type ConfigSyncResponse = ExtensionApiResponse<{
  config: RemoteConfigData;
}>;

// ==================== Browsing Log Sync ====================

/**
 * Browsing Log Entry
 */
export type BrowsingLogItem = {
  url: string;
  domain: string;
  visited_at: string; // ISO 8601
  is_whitelisted: boolean;
  is_blacklisted: boolean;
};

/**
 * Browsing Log Sync request
 */
export type BrowsingLogSyncRequest = {
  device_id: string;
  logs: BrowsingLogItem[];
};

/**
 * Browsing Log Sync response
 */
export type BrowsingLogSyncResponse = ExtensionApiResponse<{
  syncedCount: number;
}>;

export const browsingLogSyncSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  user_id: z.string().optional(),
  logs: z.array(
    z.object({
      url: z.string().url("Invalid URL format"),
      domain: z.string().min(1, "domain is required"),
      visited_at: z.string().datetime("visited_at must be ISO 8601 format"),
      is_whitelisted: z.boolean(),
      is_blacklisted: z.boolean(),
    })
  ),
});

// ==================== Block Log Sync ====================

/**
 * Block Log Entry
 */
export type BlockLogItem = {
  url: string;
  domain: string;
  block_reason: string;
  blocked_at: string; // ISO 8601
};

/**
 * Block Log Sync request
 */
export type BlockLogSyncRequest = {
  device_id: string;
  logs: BlockLogItem[];
};

/**
 * Block Log Sync response
 */
export type BlockLogSyncResponse = ExtensionApiResponse<{
  syncedCount: number;
}>;

export const blockLogSyncSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  user_id: z.string().optional(),
  logs: z.array(
    z.object({
      url: z.string().url("Invalid URL format"),
      domain: z.string().min(1, "domain is required"),
      block_reason: z.string().min(1, "block_reason is required"),
      blocked_at: z.string().datetime("blocked_at must be ISO 8601 format"),
    })
  ),
});

// ==================== Onboarding ====================

/**
 * Onboarding email verification request
 */
export type OnboardingVerifyRequest = {
  device_id: string;
  email: string;
};

/**
 * Onboarding email verification response
 */
export type OnboardingVerifyResponse = ExtensionApiResponse<{
  verified: boolean;
  userId?: string;
  userName?: string;
}>;

export const onboardingVerifySchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  email: z.string().email("Invalid email format"),
});

/**
 * Onboarding completion request
 */
export type OnboardingCompleteRequest = {
  device_id: string;
  email: string;
  user_id: string;
};

/**
 * Onboarding completion response
 */
export type OnboardingCompleteResponse = ExtensionApiResponse<{
  completed: boolean;
  userId: string;
}>;

export const onboardingCompleteSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  email: z.string().email("Invalid email format"),
  user_id: z.string().min(1, "user_id is required"),
});

// ==================== Heartbeat ====================

/**
 * Heartbeat request
 */
export type HeartbeatRequest = {
  device_id: string;
  extension_version?: string;
  browser_info?: string;
  os_info?: string;
};

export const heartbeatSchema = z.object({
  device_id: z.string().min(1, "device_id is required"),
  extension_version: z.string().optional(),
  browser_info: z.string().optional(),
  os_info: z.string().optional(),
});

// ==================== Extension Auth Context ====================

/**
 * Extension auth context (returned by the middleware)
 */
export type ExtensionAuthContext = {
  organizationId: string;
  tokenId: string;
  deviceId?: string;
};
