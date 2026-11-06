// src/lib/platform/identity.ts
/**
 * Platform super administrators: users with role SUPER_ADMIN and no
 * organisation. They operate the Control Panel (/super-admin) and are never
 * members of a tenant. Tenant ADMINs are organisation-scoped and never reach it.
 * No server-only imports (safe for client bundles and scripts).
 */

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

export const PLATFORM_LOGIN_PATH = "/super-admin/login";
export const PLATFORM_HOME_PATH = "/super-admin";

export interface PlatformIdentityFields {
  role: string | null | undefined;
  organizationId: string | null | undefined;
}

/** True for a platform super admin (SUPER_ADMIN without an organisation). */
export function isPlatformSuperAdmin(user: PlatformIdentityFields): boolean {
  return user.role === SUPER_ADMIN_ROLE && !user.organizationId;
}

/** Where a signed-in user without an organisation belongs. */
export function homeForUserWithoutOrganization(
  role: string | null | undefined
) {
  return role === SUPER_ADMIN_ROLE ? PLATFORM_HOME_PATH : "/onboarding";
}
