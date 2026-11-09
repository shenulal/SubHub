"use client";

import { Building2, LucideIcon, RefreshCw, UserX, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { SECTION_NAV_LINK_PROPS } from "@/components/layouts/section-layout";
import { useSafePermissions } from "@/hooks/use-permission-flag";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

interface OrgMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
  exact?: boolean;
  /** Shown only with every listed permission (the page re-checks). */
  permissionAll?: PermissionKey[];
}

const orgMenuConfig: {
  icon: LucideIcon;
  labelKey: string;
  descriptionKey?: string;
  href: string;
  exact?: boolean;
  permissionAll?: PermissionKey[];
}[] = [
  {
    icon: Building2,
    labelKey: "sidebar.menu.org.teams",
    descriptionKey: "sidebar.menu.org.teamsDescription",
    href: "/teams",
    exact: true,
  },
  {
    icon: Users,
    labelKey: "sidebar.menu.org.users",
    descriptionKey: "sidebar.menu.org.usersDescription",
    href: "/users",
    exact: true,
  },
  {
    icon: UserX,
    labelKey: "sidebar.menu.org.offboarded",
    descriptionKey: "sidebar.menu.org.offboardedDescription",
    href: "/users/offboarded",
  },
  {
    icon: RefreshCw,
    labelKey: "sidebar.menu.org.sync",
    descriptionKey: "sidebar.menu.org.syncDescription",
    href: "/org/sync",
    permissionAll: ["teams:manage", "members:manage"],
  },
];

export function OrgSidebar() {
  const pathname = usePathname();
  const t = useTranslations();
  const { can, isLoading } = useSafePermissions();

  const menuItems: OrgMenuItem[] = useMemo(
    () =>
      orgMenuConfig.map((item) => ({
        icon: item.icon,
        label: t(item.labelKey),
        href: item.href,
        description: item.descriptionKey ? t(item.descriptionKey) : undefined,
        exact: item.exact,
        permissionAll: item.permissionAll,
      })),
    [t]
  );
  const visibleItems = menuItems.filter(
    (item) =>
      !item.permissionAll ||
      (!isLoading && item.permissionAll.every((key) => can(key)))
  );

  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
      {visibleItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
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
