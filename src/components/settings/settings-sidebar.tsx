"use client";

import {
  Bell,
  BellRing,
  Building2,
  CheckSquare,
  Database,
  KeyRound,
  LucideIcon,
  Mail,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { SECTION_NAV_LINK_PROPS } from "@/components/layouts/section-layout";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

/** Any of these opens the Master data hub (the page re-checks the same list). */
const MASTER_DATA_READ: PermissionKey[] = [
  "masters:read",
  "catalog:read",
  "categories:read",
  "tags:read",
  "custom_fields:read",
  "apps:read",
];

interface SettingsMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
  /** Shown when the viewer holds any of these; omitted = every signed-in user. */
  permissionAny?: readonly PermissionKey[];
}

const settingsMenuConfig: {
  icon: LucideIcon;
  labelKey: string;
  descriptionKey?: string;
  href: string;
  permissionAny?: readonly PermissionKey[];
}[] = [
  {
    icon: User,
    labelKey: "settings.sidebar.profile.title",
    descriptionKey: "settings.sidebar.profile.description",
    href: "/settings/profile",
  },
  {
    icon: Building2,
    labelKey: "settings.sidebar.organization.title",
    descriptionKey: "settings.sidebar.organization.description",
    href: "/settings/organization",
    permissionAny: ["organization:manage"],
  },
  {
    icon: Users,
    labelKey: "settings.sidebar.team.title",
    descriptionKey: "settings.sidebar.team.description",
    href: "/settings/team",
    permissionAny: ["members:invite", "members:manage"],
  },
  {
    icon: Wallet,
    labelKey: "settings.sidebar.budget.title",
    descriptionKey: "settings.sidebar.budget.description",
    href: "/settings/budget",
    permissionAny: ["budgets:manage"],
  },
  {
    icon: SlidersHorizontal,
    labelKey: "platform.sidebar.workspace.title",
    descriptionKey: "platform.sidebar.workspace.description",
    href: "/settings/workspace",
    permissionAny: ["settings:manage"],
  },
  {
    icon: Database,
    labelKey: "platform.sidebar.masters.title",
    descriptionKey: "platform.sidebar.masters.description",
    href: "/settings/masters",
    permissionAny: MASTER_DATA_READ,
  },
  {
    icon: KeyRound,
    labelKey: "platform.sidebar.roles.title",
    descriptionKey: "platform.sidebar.roles.description",
    href: "/settings/roles",
    permissionAny: ["roles:manage"],
  },
  {
    icon: BellRing,
    labelKey: "platform.sidebar.templates.title",
    descriptionKey: "platform.sidebar.templates.description",
    href: "/settings/notification-templates",
    permissionAny: ["notifications:manage_templates"],
  },
  {
    icon: Monitor,
    labelKey: "settings.sidebar.appearance.title",
    descriptionKey: "settings.sidebar.appearance.description",
    href: "/settings/appearance",
  },
  {
    icon: Bell,
    labelKey: "settings.sidebar.notifications.title",
    descriptionKey: "settings.sidebar.notifications.description",
    href: "/settings/notifications",
    permissionAny: ["notifications:manage_own"],
  },
  {
    icon: CheckSquare,
    labelKey: "settings.sidebar.approvals.title",
    descriptionKey: "settings.sidebar.approvals.description",
    href: "/settings/approvals",
    permissionAny: ["approval_policies:manage"],
  },
  {
    icon: Mail,
    labelKey: "settings.sidebar.mailboxes.title",
    descriptionKey: "settings.sidebar.mailboxes.description",
    href: "/settings/mailboxes",
    permissionAny: ["mailboxes:connect_own", "mailboxes:manage"],
  },
  {
    icon: ShieldCheck,
    labelKey: "settings.sidebar.privacy.title",
    descriptionKey: "settings.sidebar.privacy.description",
    href: "/settings/privacy",
  },
];

interface SettingsSidebarProps {
  /** Effective permission keys of the viewer (resolved on the server). */
  permissions?: readonly string[];
  /** Shows every entry (kept for previews and tests). */
  isAdmin?: boolean;
}

export function SettingsSidebar({
  permissions = [],
  isAdmin = false,
}: SettingsSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const settingsMenuItems: SettingsMenuItem[] = useMemo(
    () =>
      settingsMenuConfig.map((item) => ({
        icon: item.icon,
        label: t(item.labelKey),
        href: item.href,
        description: item.descriptionKey ? t(item.descriptionKey) : undefined,
        permissionAny: item.permissionAny,
      })),
    [t]
  );
  const held = useMemo(() => new Set(permissions), [permissions]);
  const isVisible = (item: SettingsMenuItem) =>
    isAdmin ||
    !item.permissionAny ||
    item.permissionAny.some((key) => held.has(key));

  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
      {settingsMenuItems.map((item) => {
        // Permission-gated entries (pages re-check on the server)
        if (!isVisible(item)) {
          return null;
        }

        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            {...SECTION_NAV_LINK_PROPS}
            className={cn(
              "group flex shrink-0 items-start gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] leading-snug font-medium transition-colors xl:min-w-0 xl:shrink",
              isActive
                ? "bg-accent bg-primary/16! text-primary"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Icon className="mt-px size-[18px] shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span>{item.label}</span>
              {item.description && (
                <span className="text-muted-foreground group-aria-[current=page]:text-primary/75 hidden truncate text-[0.8125rem] font-normal xl:block">
                  {item.description}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
