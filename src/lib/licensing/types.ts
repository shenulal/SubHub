// src/lib/licensing/types.ts
/**
 * Licensing contract. SubHub reads every licence limit through a
 * `LicenseProvider`; the HelloPixels licensing application will plug in its own
 * provider later. Until then the community (unlicensed) provider applies.
 * Server-only data, but this file has no server imports (types are shared).
 */

export const LICENSE_EDITIONS = [
  "community",
  "standard",
  "professional",
  "enterprise",
] as const;
export type LicenseEdition = (typeof LICENSE_EDITIONS)[number];

export type LicenseStatus = "unlicensed" | "active" | "expired" | "invalid";

/** `null` means "no limit set by the licence". */
export interface LicenseLimits {
  maxTenants: number | null;
  maxUsersPerTenant: number | null;
}

export interface License {
  edition: LicenseEdition;
  status: LicenseStatus;
  /** Who issued / manages the licence (shown read-only in the panel). */
  issuer: string;
  licensee: string | null;
  limits: LicenseLimits;
  /** ISO date; null = no expiry. */
  expiresAt: string | null;
  /** Feature keys the licence enables. */
  features: string[];
}

export interface LicenseContext {
  installationId: string;
  deploymentMode: "single-tenant" | "saas";
}

export interface LicenseProvider {
  /** Stable provider id, e.g. "community" or "hellopixels". */
  readonly id: string;
  getLicense(context: LicenseContext): Promise<License>;
}

export type LimitVerdict =
  | { allowed: true; limit: number | null; used: number }
  | { allowed: false; limit: number; used: number; reason: string };
