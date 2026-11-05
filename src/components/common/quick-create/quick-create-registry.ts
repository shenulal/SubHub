// src/components/common/quick-create/quick-create-registry.ts
/**
 * Everything the global "+ New" menu and the ⌘K palette can create. Entries with
 * an `href` navigate to their full page; the others open a compact dialog in
 * place (rendered by `QuickCreateProvider`). Each entry is shown only to users
 * holding its permission — the server actions re-check it.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";
import {
  AppWindow,
  Banknote,
  Building,
  ClipboardCheck,
  CreditCard,
  FolderTree,
  type LucideIcon,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";

export type QuickCreateKind =
  | "subscription"
  | "app"
  | "approval"
  | "team"
  | "category"
  | "tag"
  | "invite"
  | "costCenter"
  | "paymentMethod";

export interface QuickCreateEntry {
  kind: QuickCreateKind;
  icon: LucideIcon;
  permission: PermissionKey;
  /** Full page to open instead of a dialog. */
  href?: string;
  /** Where the dialog's records are managed (used outside the app shell). */
  manageHref: string;
  /** Extra words the command palette matches on. */
  keywords: string[];
}

export const QUICK_CREATE_ENTRIES: readonly QuickCreateEntry[] = [
  {
    kind: "subscription",
    manageHref: "/subscriptions",
    icon: CreditCard,
    permission: "subscriptions:create",
    href: "/subscriptions/new",
    keywords: ["add", "register", "saas", "licence", "license"],
  },
  {
    kind: "app",
    manageHref: "/apps",
    icon: AppWindow,
    permission: "apps:manage",
    keywords: ["vendor", "service", "tool", "software"],
  },
  {
    kind: "approval",
    manageHref: "/approvals",
    icon: ClipboardCheck,
    permission: "approvals:create",
    href: "/approvals/new",
    keywords: ["request", "purchase", "approve"],
  },
  {
    kind: "team",
    manageHref: "/teams",
    icon: Users,
    permission: "teams:manage",
    keywords: ["department", "group"],
  },
  {
    kind: "category",
    manageHref: "/settings/masters?tab=categories",
    icon: FolderTree,
    permission: "categories:manage",
    keywords: ["taxonomy", "classification"],
  },
  {
    kind: "tag",
    manageHref: "/settings/masters?tab=tags",
    icon: Tag,
    permission: "tags:create",
    keywords: ["label"],
  },
  {
    kind: "invite",
    manageHref: "/settings/team",
    icon: UserPlus,
    permission: "members:invite",
    keywords: ["user", "member", "people", "email", "invitation"],
  },
  {
    kind: "costCenter",
    manageHref: "/settings/masters?tab=cost-centers",
    icon: Building,
    permission: "masters:manage",
    keywords: ["cost center", "department", "budget"],
  },
  {
    kind: "paymentMethod",
    manageHref: "/settings/masters?tab=payment-methods",
    icon: Banknote,
    permission: "masters:manage",
    keywords: ["card", "bank", "invoice", "payment"],
  },
];

/** Entries the viewer may use, in menu order. */
export function allowedQuickCreateEntries(
  can: (permission: PermissionKey) => boolean
): QuickCreateEntry[] {
  return QUICK_CREATE_ENTRIES.filter((entry) => can(entry.permission));
}

/** Palette matching: every query token must appear in the label or keywords. */
export function matchesQuickCreate(
  entry: QuickCreateEntry,
  label: string,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = ["new", "create", label, ...entry.keywords]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}
