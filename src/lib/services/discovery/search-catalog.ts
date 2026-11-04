// src/lib/services/discovery/search-catalog.ts
/**
 * Static entries for the command palette: pages and quick actions. Each entry
 * carries the permission needed to see it and keywords for matching. Labels are
 * i18n keys under `discovery.search.catalog.*`; `title` is the English fallback.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { SearchGroupKey, SearchResultItem } from "@/types/discovery";

export interface CatalogEntry {
  id: string;
  group: Extract<SearchGroupKey, "pages" | "actions">;
  title: string;
  labelKey: string;
  href: string;
  keywords: string[];
  permission?: PermissionKey;
}

export const SEARCH_CATALOG: readonly CatalogEntry[] = [
  // Pages
  {
    id: "page-dashboard",
    group: "pages",
    title: "Dashboard",
    labelKey: "dashboard",
    href: "/dashboard",
    keywords: ["home", "overview", "kpi"],
    permission: "reports:read",
  },
  {
    id: "page-subscriptions",
    group: "pages",
    title: "Subscriptions",
    labelKey: "subscriptions",
    href: "/subscriptions",
    keywords: ["list", "subs", "saas"],
    permission: "subscriptions:read",
  },
  {
    id: "page-pipeline",
    group: "pages",
    title: "Renewal pipeline",
    labelKey: "pipeline",
    href: "/subscriptions/pipeline",
    keywords: ["renewals", "kanban", "upcoming"],
    permission: "subscriptions:read",
  },
  {
    id: "page-calendar",
    group: "pages",
    title: "Renewal calendar",
    labelKey: "calendar",
    href: "/subscriptions/calendar",
    keywords: ["renewals", "month", "dates"],
    permission: "subscriptions:read",
  },
  {
    id: "page-receipts",
    group: "pages",
    title: "Receipts",
    labelKey: "receipts",
    href: "/subscriptions/receipts",
    keywords: ["email", "invoices", "mailbox"],
    permission: "subscriptions:read",
  },
  {
    id: "page-archived",
    group: "pages",
    title: "Archived subscriptions",
    labelKey: "archived",
    href: "/subscriptions?archived=1&status=ARCHIVED",
    keywords: ["archive", "old"],
    permission: "subscriptions:read",
  },
  {
    id: "page-approvals",
    group: "pages",
    title: "Approvals",
    labelKey: "approvals",
    href: "/approvals",
    keywords: ["requests", "inbox", "approve"],
    permission: "approvals:read",
  },
  {
    id: "page-notifications",
    group: "pages",
    title: "Notifications",
    labelKey: "notifications",
    href: "/notifications",
    keywords: ["alerts", "inbox"],
    permission: "notifications:read",
  },
  {
    id: "page-reports",
    group: "pages",
    title: "Reports",
    labelKey: "reports",
    href: "/reports/cost",
    keywords: ["cost", "analytics", "spend"],
    permission: "reports:read",
  },
  {
    id: "page-members",
    group: "pages",
    title: "Members",
    labelKey: "members",
    href: "/users",
    keywords: ["users", "people", "team"],
    permission: "members:read",
  },
  {
    id: "page-settings",
    group: "pages",
    title: "Settings",
    labelKey: "settings",
    href: "/settings",
    keywords: ["preferences", "organisation", "organization"],
    permission: "settings:read",
  },
  {
    id: "page-taxonomy",
    group: "pages",
    title: "Categories & tags",
    labelKey: "taxonomy",
    href: "/settings/taxonomy",
    keywords: ["categories", "tags", "custom fields"],
    permission: "categories:read",
  },
  // Actions
  {
    id: "action-new-subscription",
    group: "actions",
    title: "Add subscription",
    labelKey: "newSubscription",
    href: "/subscriptions/new",
    keywords: ["create", "new", "register"],
    permission: "subscriptions:create",
  },
  {
    id: "action-new-approval",
    group: "actions",
    title: "Request approval",
    labelKey: "newApproval",
    href: "/approvals/new",
    keywords: ["create", "new", "request"],
    permission: "approvals:create",
  },
  {
    id: "action-export",
    group: "actions",
    title: "Export subscriptions",
    labelKey: "exportSubscriptions",
    href: "/subscriptions?export=1",
    keywords: ["csv", "download"],
    permission: "subscriptions:export",
  },
  {
    id: "action-invite",
    group: "actions",
    title: "Invite member",
    labelKey: "inviteMember",
    href: "/users?invite=1",
    keywords: ["add user", "invitation"],
    permission: "members:invite",
  },
];

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Match an entry when every query token appears in title or keywords. */
export function matchesCatalog(entry: CatalogEntry, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const haystack = [entry.title, ...entry.keywords].join(" ").toLowerCase();
  return q.split(" ").every((token) => haystack.includes(token));
}

export function searchCatalog(
  query: string,
  permissions: ReadonlySet<string>,
  limit: number
): SearchResultItem[] {
  return SEARCH_CATALOG.filter(
    (e) =>
      (!e.permission || permissions.has(e.permission)) &&
      matchesCatalog(e, query)
  )
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      group: e.group,
      title: e.title,
      labelKey: e.labelKey,
      href: e.href,
      permission: e.permission,
    }));
}
