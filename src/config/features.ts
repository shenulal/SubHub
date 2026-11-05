// src/config/features.ts
/**
 * Feature Flags
 * Feature flags controlling features outside the MVP scope
 */

export const FEATURES = {
  /** Organisation settings - team/department management (V2) */
  ORGANIZATION_TEAMS: false,

  /** Organisation settings - logo URL setting (V2) */
  ORGANIZATION_LOGO: false,

  /** Organisation settings - multi-domain management */
  ORGANIZATION_DOMAINS: true,
} as const;
