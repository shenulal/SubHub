// src/lib/rbac/permissions.ts
/**
 * Permission catalogue. Keys are `resource:action`. The catalogue is seeded into the
 * `permissions` table (see prisma/seeds/permissions.ts) and granted to roles via
 * `role_permissions`. System roles get the default grants defined below; admins can
 * create custom roles with any subset.
 */

export interface PermissionDefinition {
  key: string;
  resource: string;
  action: string;
  group: string;
  description: string;
}

function p(
  resource: string,
  action: string,
  group: string,
  description: string
): PermissionDefinition {
  return { key: `${resource}:${action}`, resource, action, group, description };
}

export const PERMISSIONS = [
  // Subscriptions
  p("subscriptions", "read", "Subscriptions", "View subscriptions"),
  p("subscriptions", "create", "Subscriptions", "Add subscriptions"),
  p(
    "subscriptions",
    "update",
    "Subscriptions",
    "Edit, pause, archive subscriptions"
  ),
  p("subscriptions", "delete", "Subscriptions", "Delete subscriptions"),
  p("subscriptions", "bulk", "Subscriptions", "Bulk edit subscriptions"),
  p("subscriptions", "export", "Subscriptions", "Export subscription data"),
  p(
    "subscriptions",
    "read_all",
    "Subscriptions",
    "See every subscription, not only own/team"
  ),
  // Approvals
  p("approvals", "read", "Approvals", "View own approval requests"),
  p("approvals", "read_all", "Approvals", "View all approval requests"),
  p("approvals", "create", "Approvals", "Submit approval requests"),
  p(
    "approvals",
    "decide",
    "Approvals",
    "Approve, reject or request information"
  ),
  p("approvals", "cancel_any", "Approvals", "Cancel any pending request"),
  p("approvals", "export", "Approvals", "Export approval history"),
  p("approval_policies", "read", "Approvals", "View approval policies"),
  p(
    "approval_policies",
    "manage",
    "Approvals",
    "Create and edit approval policies"
  ),
  // Taxonomy & masters
  p("categories", "read", "Taxonomy", "View categories"),
  p("categories", "manage", "Taxonomy", "Create, rename, archive categories"),
  p("tags", "read", "Taxonomy", "View tags"),
  p("tags", "create", "Taxonomy", "Create tags while editing"),
  p("tags", "manage", "Taxonomy", "Rename, merge and delete tags"),
  p("custom_fields", "read", "Taxonomy", "View custom fields"),
  p("custom_fields", "manage", "Taxonomy", "Define custom fields"),
  p(
    "masters",
    "read",
    "Masters",
    "View currencies, tax rates, cost centres, payment methods"
  ),
  p("masters", "manage", "Masters", "Edit master data"),
  p(
    "masters",
    "manage_global",
    "Masters",
    "Create and edit platform-wide masters: currencies, countries"
  ),
  p("catalog", "read", "Masters", "View the vendor catalog"),
  p(
    "catalog",
    "manage",
    "Masters",
    "Edit vendor catalog entries and cancellation guides"
  ),
  // Documents
  p("attachments", "read", "Documents", "View and download attachments"),
  p("attachments", "upload", "Documents", "Upload attachments"),
  p("attachments", "delete", "Documents", "Delete attachments"),
  p("comments", "create", "Documents", "Add notes and comments"),
  // Notifications
  p("notifications", "read", "Notifications", "View notification centre"),
  p(
    "notifications",
    "manage_own",
    "Notifications",
    "Change own notification preferences"
  ),
  p(
    "notifications",
    "manage_templates",
    "Notifications",
    "Edit notification templates"
  ),
  // People & teams
  p("members", "read", "Members", "View members"),
  p("members", "invite", "Members", "Invite members"),
  p("members", "manage", "Members", "Change roles, deactivate members"),
  p("teams", "read", "Members", "View teams"),
  p("teams", "manage", "Members", "Create and edit teams, assign approvers"),
  p("roles", "manage", "Members", "Create custom roles and grant permissions"),
  // Finance & payments
  p("payments", "read", "Finance", "View payment records and cards"),
  p("payments", "manage", "Finance", "Import, match and edit payments"),
  p("budgets", "manage", "Finance", "Set budgets and thresholds"),
  // Insights
  p("reports", "read", "Insights", "View dashboards and reports"),
  p("reports", "export", "Insights", "Export reports"),
  p("audit", "read", "Insights", "View audit log"),
  p("audit", "export", "Insights", "Export audit log"),
  // Integrations
  p("integrations", "read", "Integrations", "View integrations"),
  p("integrations", "manage", "Integrations", "Connect and sync integrations"),
  p(
    "mailboxes",
    "connect_own",
    "Integrations",
    "Connect own mailbox for receipt detection"
  ),
  p("mailboxes", "manage", "Integrations", "Manage all mailbox connections"),
  // Settings
  p("settings", "read", "Settings", "View organisation settings"),
  p("settings", "manage", "Settings", "Change organisation settings"),
  p(
    "organization",
    "manage",
    "Settings",
    "Edit organisation profile and domains"
  ),
  // Privacy
  p("data", "export_own", "Privacy", "Export own data"),
  p("data", "delete_own", "Privacy", "Delete own account"),
  p("data", "export_org", "Privacy", "Export organisation data"),
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSIONS.map(
  (x) => x.key
);

export function isPermissionKey(key: string): key is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(key);
}

/** System roles mirror the UserRole enum (SUPER_ADMIN is implicit: everything). */
export type SystemRoleKey = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER";

const VIEWER_GRANTS: PermissionKey[] = [
  "subscriptions:read",
  "approvals:read",
  "approval_policies:read",
  "categories:read",
  "tags:read",
  "custom_fields:read",
  "masters:read",
  "catalog:read",
  "attachments:read",
  "notifications:read",
  "notifications:manage_own",
  "members:read",
  "teams:read",
  "reports:read",
  "integrations:read",
  "settings:read",
  "data:export_own",
  "data:delete_own",
];

const MEMBER_GRANTS: PermissionKey[] = [
  ...VIEWER_GRANTS,
  "subscriptions:create",
  "subscriptions:update",
  "subscriptions:export",
  "approvals:create",
  "tags:create",
  "attachments:upload",
  "comments:create",
  "payments:read",
  "audit:read",
  "mailboxes:connect_own",
];

const APPROVER_GRANTS: PermissionKey[] = [
  ...MEMBER_GRANTS,
  "subscriptions:read_all",
  "approvals:read_all",
  "approvals:decide",
  "approvals:export",
  "reports:export",
];

const ADMIN_GRANTS: PermissionKey[] = [...PERMISSION_KEYS];

export const SYSTEM_ROLE_TEMPLATES: Record<
  SystemRoleKey,
  { name: string; description: string; grants: PermissionKey[] }
> = {
  ADMIN: {
    name: "Administrator",
    description: "Full control over the workspace, settings, members and data",
    grants: ADMIN_GRANTS,
  },
  APPROVER: {
    name: "Approver",
    description:
      "Reviews and decides approval requests, sees all subscriptions",
    grants: Array.from(new Set(APPROVER_GRANTS)),
  },
  MEMBER: {
    name: "Member",
    description:
      "Tracks subscriptions, submits requests, manages own preferences",
    grants: Array.from(new Set(MEMBER_GRANTS)),
  },
  VIEWER: {
    name: "Viewer",
    description: "Read-only access to subscriptions, approvals and reports",
    grants: Array.from(new Set(VIEWER_GRANTS)),
  },
};

/**
 * Permissions added after organisations were created. `applyPermissionRollouts`
 * (run by `npm run db:backfill-defaults`) grants each key to every existing
 * system role whose template includes it. System-role grants cannot be edited
 * by hand (only reset to the template), so re-applying is safe and idempotent.
 */
export const PERMISSION_ROLLOUTS: readonly PermissionKey[] = [
  "masters:manage_global",
  "catalog:read",
];

export const SYSTEM_ROLE_KEYS = Object.keys(
  SYSTEM_ROLE_TEMPLATES
) as SystemRoleKey[];

export function permissionsByGroup(): Record<string, PermissionDefinition[]> {
  return PERMISSIONS.reduce<Record<string, PermissionDefinition[]>>(
    (acc, def) => {
      (acc[def.group] ??= []).push(def);
      return acc;
    },
    {}
  );
}
