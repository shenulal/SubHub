import { AccessControlProvider } from "@refinedev/core";

type Role = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";
type Action =
  | "list"
  | "show"
  | "create"
  | "edit"
  | "delete"
  | "invite"
  | "sync"
  | "approve"
  | "export";
type Resource =
  | "apps"
  | "subscriptions"
  | "users"
  | "integrations"
  | "payments"
  | "audit-logs"
  | "approvals"
  | "approval-policies"
  | "categories"
  | "tags"
  | "custom-fields"
  | "saved-views"
  | "notifications"
  | "attachments";

/**
 * Per-resource permission matrix
 * Based on the CLAUDE.md permission matrix
 *
 * | Resource | ADMIN | MEMBER | VIEWER |
 * |--------|-------|--------|--------|
 * | apps | CRUD | Read+Create | Read only |
 * | subscriptions | CRUD | Read+Create | Read only |
 * | users | CRUD+Invite | Read only | Read only |
 * | integrations | CRUD+Sync | Read only | Read only |
 * | payments | CRUD | Read only | None |
 * | audit-logs | Full | Limited | None |
 */
const PERMISSION_MATRIX: Record<Role, Record<Resource, Action[]>> = {
  ADMIN: {
    apps: ["list", "show", "create", "edit", "delete"],
    subscriptions: ["list", "show", "create", "edit", "delete", "export"],
    users: ["list", "show", "create", "edit", "delete", "invite"],
    integrations: ["list", "show", "create", "edit", "delete", "sync"],
    payments: ["list", "show", "create", "edit", "delete"],
    "audit-logs": ["list", "show", "export"],
    approvals: [
      "list",
      "show",
      "create",
      "edit",
      "delete",
      "approve",
      "export",
    ],
    "approval-policies": ["list", "show", "create", "edit", "delete"],
    categories: ["list", "show", "create", "edit", "delete"],
    tags: ["list", "show", "create", "edit", "delete"],
    "custom-fields": ["list", "show", "create", "edit", "delete"],
    "saved-views": ["list", "show", "create", "edit", "delete"],
    notifications: ["list", "show", "edit", "delete"],
    attachments: ["list", "show", "create", "delete"],
  },
  APPROVER: {
    apps: ["list", "show", "create"],
    subscriptions: ["list", "show", "create", "edit", "export"],
    users: ["list", "show"],
    integrations: ["list", "show"],
    payments: ["list", "show"],
    "audit-logs": ["list", "show"],
    approvals: ["list", "show", "create", "approve", "export"],
    "approval-policies": ["list", "show"],
    categories: ["list", "show"],
    tags: ["list", "show", "create"],
    "custom-fields": ["list", "show"],
    "saved-views": ["list", "show", "create", "edit", "delete"],
    notifications: ["list", "show", "edit", "delete"],
    attachments: ["list", "show", "create"],
  },
  MEMBER: {
    apps: ["list", "show", "create"],
    subscriptions: ["list", "show", "create", "edit"],
    users: ["list", "show"],
    integrations: ["list", "show"],
    payments: ["list", "show"],
    "audit-logs": ["list", "show"], // own activity only (filtered server-side)
    approvals: ["list", "show", "create"], // own requests only
    "approval-policies": ["list", "show"],
    categories: ["list", "show"],
    tags: ["list", "show", "create"],
    "custom-fields": ["list", "show"],
    "saved-views": ["list", "show", "create", "edit", "delete"],
    notifications: ["list", "show", "edit", "delete"],
    attachments: ["list", "show", "create"],
  },
  VIEWER: {
    apps: ["list", "show"],
    subscriptions: ["list", "show"],
    users: ["list", "show"],
    integrations: ["list", "show"],
    payments: [],
    "audit-logs": [],
    approvals: ["list", "show"],
    "approval-policies": ["list", "show"],
    categories: ["list", "show"],
    tags: ["list", "show"],
    "custom-fields": ["list", "show"],
    "saved-views": ["list", "show", "create", "edit", "delete"],
    notifications: ["list", "show", "edit"],
    attachments: ["list", "show"],
  },
};

/**
 * Maps API resource names to permission-matrix resource names
 */
function normalizeResource(resource: string | undefined): Resource | null {
  if (!resource) return null;

  // Exact match
  if (resource in PERMISSION_MATRIX.ADMIN) {
    return resource as Resource;
  }

  // Try singular/plural conversion
  const resourceMap: Record<string, Resource> = {
    app: "apps",
    subscription: "subscriptions",
    user: "users",
    integration: "integrations",
    payment: "payments",
    "audit-log": "audit-logs",
    auditLogs: "audit-logs",
    auditLog: "audit-logs",
    approval: "approvals",
    "approval-request": "approvals",
    approvalRequests: "approvals",
    "approval-policy": "approval-policies",
    approvalPolicies: "approval-policies",
    category: "categories",
    tag: "tags",
    "custom-field": "custom-fields",
    customFields: "custom-fields",
    "saved-view": "saved-views",
    savedViews: "saved-views",
    notification: "notifications",
    attachment: "attachments",
  };

  return resourceMap[resource] ?? null;
}

// Session cache (avoids repeated session calls)
let cachedRole: Role | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Resolve the role, trying params → cache → /api/auth/session in that order
 */
async function resolveRole(
  params: Record<string, unknown> | undefined
): Promise<Role | null> {
  // 1. Try params first (backward compatible)
  const paramRole = (params as { user?: { role?: string } })?.user?.role;
  if (paramRole) return paramRole as Role;

  // 2. Use the cache
  if (cachedRole && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedRole;
  }

  // 3. Look up the session
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    if (!res.ok) return null;
    const session = await res.json();
    cachedRole = (session?.user?.role as Role) ?? null;
    cacheTimestamp = Date.now();
    return cachedRole;
  } catch {
    return null;
  }
}

/** Reset the cache (for tests) */
function resetRoleCache() {
  cachedRole = null;
  cacheTimestamp = 0;
}

/**
 * Refine AccessControlProvider
 * - Per-resource permission checks based on PERMISSION_MATRIX
 * - ADMIN: full access to all resources
 * - MEMBER: limited per-resource access (can create apps/subscriptions)
 * - VIEWER: read-only (no access to payments or audit-logs)
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ action, resource, params }) => {
    const role = await resolveRole(params);

    // Deny when there is no role
    if (!role) {
      return { can: false, reason: "Permission denied." };
    }

    // Without a resource, apply the default rules (backward compatibility)
    const normalizedResource = normalizeResource(resource);
    if (!normalizedResource) {
      // Keep the legacy behaviour when called without a resource
      if (role === "ADMIN") {
        return { can: true };
      }
      if (role === "VIEWER") {
        const isReadOnly = action === "list" || action === "show";
        return isReadOnly
          ? { can: true }
          : { can: false, reason: "VIEWER has read-only access." };
      }
      if (role === "MEMBER" || role === "APPROVER") {
        if (action === "delete") {
          return {
            can: false,
            reason: "MEMBER does not have delete permission.",
          };
        }
        return { can: true };
      }
      return { can: false, reason: "Permission denied." };
    }

    // Check against PERMISSION_MATRIX
    const allowedActions = PERMISSION_MATRIX[role]?.[normalizedResource] ?? [];
    const isAllowed = allowedActions.includes(action as Action);

    if (isAllowed) {
      return { can: true };
    }

    // Build the denial reason
    const resourceLabel = {
      apps: "apps",
      subscriptions: "subscriptions",
      users: "users",
      integrations: "integrations",
      payments: "payments",
      "audit-logs": "audit logs",
      approvals: "approval requests",
      "approval-policies": "approval policies",
      categories: "categories",
      tags: "tags",
      "custom-fields": "custom fields",
      "saved-views": "saved views",
      notifications: "notifications",
      attachments: "attachments",
    }[normalizedResource];

    const actionLabel = {
      list: "list",
      show: "view",
      create: "create",
      edit: "edit",
      delete: "delete",
      invite: "invite",
      sync: "sync",
      approve: "approve",
      export: "export",
    }[action as Action];

    return {
      can: false,
      reason: `You do not have ${actionLabel ?? action} permission for ${resourceLabel}.`,
    };
  },
};

// Exported for tests
export { normalizeResource, PERMISSION_MATRIX, resetRoleCache, resolveRole };
export type { Action, Resource, Role };
