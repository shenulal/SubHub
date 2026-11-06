// src/lib/api/auth-middleware.ts
/**
 * API route authentication middleware
 *
 * Rather than relying only on the session check in Server Actions,
 * authentication is verified defensively at the API level (defense in depth).
 */

import { getCachedSession } from "@/lib/auth/require-auth";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { getUserPermissionSet, hasAll, hasAny } from "@/lib/rbac/service";
import { NextRequest, NextResponse } from "next/server";

// Authenticated session type
export type AuthenticatedSession = NonNullable<
  Awaited<ReturnType<typeof getCachedSession>>
> & {
  user: {
    id: string;
    organizationId: string;
    role: string;
    email?: string | null;
    name?: string | null;
  };
};

// Authenticated handler type
export type AuthenticatedHandler = (
  request: NextRequest,
  context: { session: AuthenticatedSession }
) => Promise<NextResponse>;

// Role type
export type Role = "SUPER_ADMIN" | "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";

// Middleware options
export interface ApiAuthOptions {
  /** Whether the ADMIN role is required (deprecated: prefer allowRoles) */
  requireAdmin?: boolean;
  /** Allowed roles (when set, only these roles are allowed) */
  allowRoles?: Role[];
  /** Whether to block VIEWER (default: false) */
  blockViewer?: boolean;
  /** SubHub RBAC: required permission key(s) (checked after role options) */
  permission?: PermissionKey | PermissionKey[];
  /** "all" (default) or "any" of the listed permissions */
  permissionMode?: "all" | "any";
}

import { logger } from "@/lib/logger";

/**
 * HOF (higher-order function) that applies API route authentication
 *
 * @example
 * ```typescript
 * export const GET = withApiAuth(async (request, { session }) => {
 *   const data = await getData(session.user.organizationId);
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withApiAuth(
  handler: AuthenticatedHandler,
  options: ApiAuthOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const session = await getCachedSession();

    // Validate the session
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // A temporary password must be replaced before the account can be used
    if (session.user.mustChangePassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Password change required",
          code: "PASSWORD_CHANGE_REQUIRED",
        },
        { status: 403 }
      );
    }

    // Validate the organization (SUPER_ADMIN is allowed without one)
    const userRole = session.user.role as Role;
    if (!session.user.organizationId && userRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Organization information is required" },
        { status: 403 }
      );
    }

    // Role-based permission check
    // allowRoles option: allow only specific roles
    if (options.allowRoles && options.allowRoles.length > 0) {
      if (!options.allowRoles.includes(userRole)) {
        return NextResponse.json(
          { error: "You do not have permission to perform this action" },
          { status: 403 }
        );
      }
    }

    // requireAdmin option (backward compatibility)
    if (options.requireAdmin && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin permission required" },
        { status: 403 }
      );
    }

    // blockViewer option: block VIEWER
    if (options.blockViewer && userRole === "VIEWER") {
      return NextResponse.json(
        { error: "Read-only users cannot perform this action" },
        { status: 403 }
      );
    }

    // SubHub RBAC: permission check
    if (options.permission) {
      const permissionSet = await getUserPermissionSet(
        session.user.id,
        session.user.organizationId ?? null
      );
      const allowed =
        (options.permissionMode ?? "all") === "all"
          ? hasAll(permissionSet, options.permission)
          : hasAny(permissionSet, options.permission);
      if (!allowed) {
        return NextResponse.json(
          { success: false, error: "Forbidden: missing permission" },
          { status: 403 }
        );
      }
    }

    // Log the authentication context
    logger.debug(
      {
        userId: session.user.id,
        orgId: session.user.organizationId,
        role: userRole,
      },
      "authenticated"
    );

    // Invoke the handler
    return handler(request, {
      session: session as unknown as AuthenticatedSession,
    });
  };
}
