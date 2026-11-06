// src/lib/licensing/community.ts
/**
 * Default provider: an unlicensed community installation. It sets no tenant or
 * user limits and no expiry — SubHub enforces nothing until the HelloPixels
 * licensing application supplies a real licence through `setLicenseProvider`.
 */
import type { License, LicenseContext, LicenseProvider } from "./types";

export const LICENSE_ISSUER = "HelloPixels licensing application";

/** Product areas available to every installation (community edition). */
export const COMMUNITY_FEATURES = [
  "subscriptions",
  "approvals",
  "notifications",
  "reports",
  "integrations",
  "browser-extension",
  "mobile-api",
] as const;

export class CommunityLicenseProvider implements LicenseProvider {
  readonly id = "community";

  async getLicense(_context: LicenseContext): Promise<License> {
    return {
      edition: "community",
      status: "unlicensed",
      issuer: LICENSE_ISSUER,
      licensee: null,
      limits: {
        // Single-tenant installations hold one organisation by deployment mode,
        // not by licence; the licence itself sets no limit.
        maxTenants: null,
        maxUsersPerTenant: null,
      },
      expiresAt: null,
      features: [...COMMUNITY_FEATURES],
    };
  }
}
