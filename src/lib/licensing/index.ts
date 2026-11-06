// src/lib/licensing/index.ts
/**
 * Licence access point (server-only). Everything that needs a licence limit
 * calls `getLicense()` / `checkLimit()` here, never a literal — so the
 * HelloPixels licensing application can replace the provider without code
 * changes elsewhere.
 */
import { getDeploymentMode } from "@/lib/deployment/mode";
import { CommunityLicenseProvider } from "./community";
import { getInstallationId } from "./installation";
import type {
  License,
  LicenseLimits,
  LicenseProvider,
  LimitVerdict,
} from "./types";

export { LICENSE_ISSUER } from "./community";
export { getInstallationId } from "./installation";
export type * from "./types";

let provider: LicenseProvider = new CommunityLicenseProvider();

export function getLicenseProvider(): LicenseProvider {
  return provider;
}

/** Plug-in point for the licensing application (and tests). */
export function setLicenseProvider(next: LicenseProvider): void {
  provider = next;
}

export function resetLicenseProvider(): void {
  provider = new CommunityLicenseProvider();
}

export async function getLicense(): Promise<License> {
  const installationId = await getInstallationId();
  return provider.getLicense({
    installationId,
    deploymentMode: getDeploymentMode(),
  });
}

export function isLicenseExpired(license: License, now = new Date()): boolean {
  return license.expiresAt !== null && new Date(license.expiresAt) < now;
}

/** Compare a usage count with a licence limit (`null` = unlimited). */
export function evaluateLimit(
  limit: number | null,
  used: number,
  label: string
): LimitVerdict {
  if (limit === null || used < limit) return { allowed: true, limit, used };
  return {
    allowed: false,
    limit,
    used,
    reason: `The licence allows ${limit} ${label}; ${used} already exist. Contact HelloPixels to extend the licence.`,
  };
}

/** Read one limit through the provider and evaluate it against usage. */
export async function checkLimit(
  key: keyof LicenseLimits,
  used: number
): Promise<LimitVerdict> {
  const license = await getLicense();
  const label = key === "maxTenants" ? "tenants" : "users per tenant";
  return evaluateLimit(license.limits[key], used, label);
}
