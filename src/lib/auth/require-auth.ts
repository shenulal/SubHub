// src/lib/auth/require-auth.ts
/**
 * Helpers to check authentication and organization in Server Actions
 * - Redirects to /login when there is no session
 * - Redirects to /onboarding when there is no organization
 */

import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./index";

// Session lookup is called from many places, so cache() prevents duplicate calls within the same request
export const getCachedSession = cache(async () => auth());

/**
 * Requires an authenticated user + organization
 * @returns Session (organizationId guaranteed)
 */
export async function requireOrganization() {
  const session = await getCachedSession();

  // No session: go to login
  if (!session?.user) {
    redirect("/login");
  }

  // No organization: go to onboarding
  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  return {
    session,
    organizationId: session.user.organizationId,
    userId: session.user.id,
    role: session.user.role as TenantRole,
    teamId: session.user.teamId ?? null,
  };
}

/**
 * Requires an authenticated user only (organization optional)
 * @returns Session
 */
export async function requireAuth() {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

// Keep the existing UserRole type (backward compatibility)
export type UserRole = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";
export type TenantRole = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";

/**
 * Requires one of the given roles
 * @param allowedRoles List of allowed roles
 * @param redirectTo Redirect path when unauthorized (default: /settings)
 * @returns Session (organizationId and role guaranteed)
 */
export async function requireRole(
  allowedRoles: TenantRole | TenantRole[],
  redirectTo: string = "/settings"
) {
  const { session, organizationId, userId, role } = await requireOrganization();

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!roles.includes(role as TenantRole)) {
    redirect(redirectTo);
  }

  return {
    session,
    organizationId,
    userId,
    role: role as TenantRole,
  };
}

/**
 * Requires Admin role
 * @param redirectTo Redirect path when unauthorized (default: /settings)
 */
export async function requireAdmin(
  redirectTo: string = "/settings"
): Promise<ReturnType<typeof requireRole>> {
  return requireRole("ADMIN", redirectTo);
}

/**
 * Requires Super Admin role (organizationId not required)
 * @returns Session (userId and role guaranteed)
 */
export async function requireSuperAdmin() {
  const session = await getCachedSession();

  if (!session?.user) {
    redirect("/login");
  }

  // SUPER_ADMIN was added to the UserRole enum (see prisma/schema.prisma)
  if ((session.user.role as string) !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return {
    session,
    userId: session.user.id,
    role: "SUPER_ADMIN" as const,
  };
}
