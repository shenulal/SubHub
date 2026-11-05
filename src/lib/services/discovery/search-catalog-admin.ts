// src/lib/services/discovery/search-catalog-admin.ts
/**
 * Command-palette entries for every Master data tab and settings page. Each one
 * carries the same permission its page checks, so the palette never offers a
 * destination the viewer would be bounced from. Labels live under
 * `discovery.search.catalog.*`.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";

import type { CatalogEntry } from "./search-catalog";

function page(
  id: string,
  title: string,
  href: string,
  keywords: string[],
  permission?: PermissionKey
): CatalogEntry {
  return {
    id: `page-${id}`,
    group: "pages",
    title,
    labelKey: `pages.${id}`,
    href,
    keywords,
    permission,
  };
}

const masterTab = (
  tab: string,
  title: string,
  keywords: string[],
  permission: PermissionKey
) =>
  page(
    `masters-${tab}`,
    title,
    `/settings/masters?tab=${tab}`,
    ["master data", "masters", ...keywords],
    permission
  );

export const MASTER_DATA_PAGES: readonly CatalogEntry[] = [
  page(
    "masters",
    "Master data",
    "/settings/masters",
    ["masters", "reference data", "lookups", "configuration"],
    "masters:read"
  ),
  masterTab(
    "currencies",
    "Currencies",
    ["fx", "exchange rate", "aed"],
    "masters:read"
  ),
  masterTab("countries", "Countries", ["regions", "gcc"], "masters:read"),
  masterTab("tax-rates", "Tax rates", ["vat", "tax"], "masters:read"),
  masterTab(
    "cost-centers",
    "Cost centres",
    ["cost center", "department"],
    "masters:read"
  ),
  masterTab(
    "payment-methods",
    "Payment methods",
    ["card", "bank", "invoice"],
    "masters:read"
  ),
  masterTab(
    "billing-cycles",
    "Billing cycles",
    ["monthly", "yearly", "cycle"],
    "masters:read"
  ),
  masterTab(
    "categories",
    "Categories",
    ["taxonomy", "category"],
    "categories:read"
  ),
  masterTab("tags", "Tags", ["labels", "taxonomy"], "tags:read"),
  masterTab(
    "custom-fields",
    "Custom fields",
    ["fields", "attributes"],
    "custom_fields:read"
  ),
  masterTab(
    "vendor-catalog",
    "Vendor catalog",
    ["vendors", "apps", "catalogue"],
    "catalog:read"
  ),
];

export const SETTINGS_PAGES: readonly CatalogEntry[] = [
  page("settings-profile", "Profile", "/settings/profile", [
    "account",
    "me",
    "password",
  ]),
  page(
    "settings-organization",
    "Organisation profile",
    "/settings/organization",
    ["company", "organization", "domains"],
    "organization:manage"
  ),
  page(
    "settings-team",
    "Members & invitations",
    "/settings/team",
    ["invitations", "users", "people"],
    "members:read"
  ),
  page(
    "settings-budget",
    "Budgets",
    "/settings/budget",
    ["budget", "threshold"],
    "budgets:manage"
  ),
  page(
    "settings-workspace",
    "Workspace settings",
    "/settings/workspace",
    ["preferences", "defaults", "locale", "finance"],
    "settings:manage"
  ),
  page(
    "settings-roles",
    "Roles & permissions",
    "/settings/roles",
    ["rbac", "access", "permissions"],
    "roles:manage"
  ),
  page(
    "settings-templates",
    "Notification templates",
    "/settings/notification-templates",
    ["email", "templates"],
    "notifications:manage_templates"
  ),
  page("settings-appearance", "Appearance", "/settings/appearance", [
    "theme",
    "dark mode",
  ]),
  page(
    "settings-notifications",
    "Notification preferences",
    "/settings/notifications",
    ["alerts", "email", "preferences"],
    "notifications:manage_own"
  ),
  page(
    "settings-approvals",
    "Approval policies",
    "/settings/approvals",
    ["workflow", "approvers", "policy"],
    "approval_policies:read"
  ),
  page(
    "settings-mailboxes",
    "Mailboxes",
    "/settings/mailboxes",
    ["email", "receipts", "gmail", "outlook"],
    "mailboxes:connect_own"
  ),
  page("settings-privacy", "Privacy & data", "/settings/privacy", [
    "gdpr",
    "export",
    "delete",
  ]),
  page(
    "teams",
    "Teams",
    "/teams",
    ["departments", "groups", "organisation"],
    "teams:read"
  ),
];
