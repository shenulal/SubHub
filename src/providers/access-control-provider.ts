// src/providers/access-control-provider.ts
/**
 * Refine AccessControlProvider backed by SubHub RBAC. `useCan({ resource, action })`
 * is answered from the signed-in user's effective permission keys
 * (`/api/v1/me/permissions`, the same set the server enforces), so custom roles
 * are honoured. The legacy `params.user.role` hint is ignored.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";
import { AccessControlProvider } from "@refinedev/core";

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

type ActionMap = Partial<Record<Action, PermissionKey>>;

function crud(read: PermissionKey, write: PermissionKey): ActionMap {
  return {
    list: read,
    show: read,
    create: write,
    edit: write,
    delete: write,
  };
}

/** Permission key required for each (resource, action) pair. */
const RESOURCE_PERMISSIONS: Record<Resource, ActionMap> = {
  apps: crud("apps:read", "apps:manage"),
  subscriptions: {
    list: "subscriptions:read",
    show: "subscriptions:read",
    create: "subscriptions:create",
    edit: "subscriptions:update",
    delete: "subscriptions:delete",
    export: "subscriptions:export",
  },
  users: {
    ...crud("members:read", "members:manage"),
    create: "members:invite",
    invite: "members:invite",
  },
  integrations: {
    ...crud("integrations:read", "integrations:manage"),
    sync: "integrations:manage",
  },
  payments: crud("payments:read", "payments:manage"),
  "audit-logs": {
    list: "audit:read",
    show: "audit:read",
    export: "audit:export",
  },
  approvals: {
    list: "approvals:read",
    show: "approvals:read",
    create: "approvals:create",
    edit: "approvals:create",
    delete: "approvals:cancel_any",
    approve: "approvals:decide",
    export: "approvals:export",
  },
  "approval-policies": crud(
    "approval_policies:read",
    "approval_policies:manage"
  ),
  categories: crud("categories:read", "categories:manage"),
  tags: { ...crud("tags:read", "tags:manage"), create: "tags:create" },
  "custom-fields": crud("custom_fields:read", "custom_fields:manage"),
  "saved-views": crud("subscriptions:read", "subscriptions:read"),
  notifications: {
    list: "notifications:read",
    show: "notifications:read",
    edit: "notifications:read",
    delete: "notifications:read",
  },
  attachments: {
    list: "attachments:read",
    show: "attachments:read",
    create: "attachments:upload",
    delete: "attachments:delete",
  },
};

const RESOURCE_ALIASES: Record<string, Resource> = {
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

/** Maps API resource names to the permission map's resource names. */
function normalizeResource(resource: string | undefined): Resource | null {
  if (!resource) return null;
  if (resource in RESOURCE_PERMISSIONS) return resource as Resource;
  return RESOURCE_ALIASES[resource] ?? null;
}

/** Permission key needed for an action, or null when none is mapped. */
function requiredPermission(
  resource: string | undefined,
  action: string
): PermissionKey | null {
  const normalized = normalizeResource(resource);
  if (!normalized) return null;
  return RESOURCE_PERMISSIONS[normalized][action as Action] ?? null;
}

const CACHE_TTL_MS = 30_000;
let cachedPermissions: Set<string> | null = null;
let cacheTimestamp = 0;

/** Permission keys from `params.permissions` (tests) or `/api/v1/me/permissions`. */
async function resolvePermissions(
  params: Record<string, unknown> | undefined
): Promise<Set<string> | null> {
  const explicit = (params as { permissions?: unknown })?.permissions;
  if (Array.isArray(explicit)) return new Set(explicit.map(String));
  if (cachedPermissions && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPermissions;
  }
  try {
    const res = await fetch("/api/v1/me/permissions", {
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { permissions?: string[] } };
    cachedPermissions = new Set(json.data?.permissions ?? []);
    cacheTimestamp = Date.now();
    return cachedPermissions;
  } catch {
    return null;
  }
}

/** Reset the cache (tests, sign-out). */
function resetPermissionCache() {
  cachedPermissions = null;
  cacheTimestamp = 0;
}

const READ_ACTIONS = new Set(["list", "show"]);

export const accessControlProvider: AccessControlProvider = {
  can: async ({ action, resource, params }) => {
    const permissions = await resolvePermissions(params);
    if (!permissions || permissions.size === 0) {
      return { can: false, reason: "Permission denied." };
    }
    const needed = requiredPermission(resource, action);
    if (needed) {
      return permissions.has(needed)
        ? { can: true }
        : {
            can: false,
            reason: `You need the "${needed}" permission for this action.`,
          };
    }
    // Unmapped resource/action: reads for any member, writes for settings managers.
    if (READ_ACTIONS.has(action) || permissions.has("settings:manage")) {
      return { can: true };
    }
    return { can: false, reason: "Permission denied." };
  },
};

// Exported for tests
export {
  normalizeResource,
  requiredPermission,
  resetPermissionCache,
  resolvePermissions,
  RESOURCE_PERMISSIONS,
};
export type { Action, Resource };
