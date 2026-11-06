// src/services/service-permissions.ts
/**
 * Permission check for the service layer (Server Actions, AI write tool).
 * Uses `ctx.permissions` when the caller already resolved them, otherwise the
 * user's effective RBAC set — never the legacy `role` enum.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";
import { getUserPermissionSet } from "@/lib/rbac/service";

export interface PermissionContext {
  organizationId: string;
  userId: string;
  /** Pre-resolved effective permission keys (optional). */
  permissions?: ReadonlySet<string>;
}

export async function ctxHasPermission(
  ctx: PermissionContext,
  permission: PermissionKey
): Promise<boolean> {
  const set =
    ctx.permissions ??
    (await getUserPermissionSet(ctx.userId, ctx.organizationId));
  return set.has(permission);
}
