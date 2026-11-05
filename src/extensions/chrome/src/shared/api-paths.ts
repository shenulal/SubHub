// src/extensions/chrome/src/shared/api-paths.ts
/**
 * SubHub API endpoint path constants
 *
 * Central registry of every API path the extension calls.
 * When a server API path changes, only this file needs updating.
 */

// API version prefix
const API_PREFIX = "/api/v1/extensions";

/**
 * Extension API endpoint paths
 */
export const API_PATHS = {
  /** Health check - GET */
  HEALTH: `${API_PREFIX}/health`,

  /** Login capture - POST */
  LOGIN: `${API_PREFIX}/login`,

  /** Usage sync - POST */
  USAGE_SYNC: `${API_PREFIX}/usage/sync`,

  /** Whitelist sync - GET, POST */
  WHITELIST_SYNC: `${API_PREFIX}/whitelist/sync`,

  /** Blacklist sync - GET */
  BLACKLIST_SYNC: `${API_PREFIX}/blacklist/sync`,

  /** Remote config sync - POST */
  CONFIG_SYNC: `${API_PREFIX}/config/sync`,

  /** Browsing log sync - POST */
  BROWSING_LOG_SYNC: `${API_PREFIX}/logs/browsing/sync`,

  /** Block log sync - POST */
  BLOCK_LOG_SYNC: `${API_PREFIX}/logs/block/sync`,

  /** Onboarding email verification - POST */
  ONBOARDING_VERIFY: `${API_PREFIX}/onboarding/verify`,

  /** Onboarding complete - POST */
  ONBOARDING_COMPLETE: `${API_PREFIX}/onboarding/complete`,

  /** Heartbeat - POST */
  HEARTBEAT: `${API_PREFIX}/heartbeat`,
} as const;

export type ApiPath = (typeof API_PATHS)[keyof typeof API_PATHS];
