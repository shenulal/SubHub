"use client";

import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  CreditCard,
  Database,
  KanbanSquare,
  LayoutDashboard,
  Link as LinkIcon,
  LogOut,
  MoreHorizontal,
  Puzzle,
  Receipt,
  Settings,
  UserCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { logout } from "@/actions/auth";
import { SubHubLogo } from "@/components/brand/subhub-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useSafePermissions } from "@/hooks/use-permission-flag";
import type { PermissionKey } from "@/lib/rbac/permissions";

// Menu item type
interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  permissionAny?: PermissionKey[];
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

interface MenuSection {
  group: string | null;
  color: string;
  items: MenuItem[];
}

interface MenuItemConfig {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  href: string;
  /** Shown when the viewer holds any of these; omitted = every signed-in user. */
  permissionAny?: PermissionKey[];
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

interface MenuSectionConfig {
  groupKey: string | null;
  color: string;
  items: MenuItemConfig[];
}

/** Any of these opens the Master data hub (the page re-checks the same list). */
const MASTER_DATA_READ: PermissionKey[] = [
  "masters:read",
  "catalog:read",
  "categories:read",
  "tags:read",
  "custom_fields:read",
  "apps:read",
];

// Menu structure (including submenus), ordered after the reference UI
const menuConfig: MenuSectionConfig[] = [
  {
    groupKey: "sidebar.group.main",
    color: "#6366F1",
    items: [
      {
        icon: LayoutDashboard,
        labelKey: "sidebar.menu.dashboard",
        href: "/dashboard",
      },
      {
        icon: BarChart3,
        labelKey: "sidebar.menu.reports.root",
        href: "/reports/cost",
        permissionAny: ["reports:read"],
      },
    ],
  },
  {
    groupKey: "sidebar.group.management",
    color: "#F59E0B",
    items: [
      {
        icon: Building2,
        labelKey: "sidebar.menu.org.root",
        href: "/teams",
        permissionAny: ["teams:read", "members:read"],
      },
      {
        icon: CreditCard,
        labelKey: "sidebar.menu.subscriptions.root",
        href: "/subscriptions",
        permissionAny: ["subscriptions:read"],
      },
      {
        icon: KanbanSquare,
        labelKey: "sidebar.menu.subscriptions.pipeline",
        href: "/subscriptions/pipeline",
        permissionAny: ["subscriptions:read"],
      },
      {
        icon: CheckSquare,
        labelKey: "sidebar.menu.approvals.root",
        href: "/approvals",
        permissionAny: ["approvals:read"],
      },
      {
        icon: Receipt,
        labelKey: "sidebar.menu.payments.root",
        href: "/payments",
        permissionAny: ["payments:read"],
      },
      {
        icon: Puzzle,
        labelKey: "sidebar.menu.extensions.root",
        href: "/extensions/usage",
        permissionAny: ["extensions:read"],
      },
    ],
  },
  {
    groupKey: "sidebar.group.system",
    color: "#64748B",
    items: [
      {
        icon: Bell,
        labelKey: "sidebar.menu.notifications",
        href: "/notifications",
        permissionAny: ["notifications:read"],
      },
      {
        icon: Database,
        labelKey: "platform.sidebar.masters.title",
        href: "/settings/masters",
        permissionAny: MASTER_DATA_READ,
      },
      {
        icon: LinkIcon,
        labelKey: "sidebar.menu.integrations",
        href: "/integrations",
        permissionAny: ["integrations:read"],
      },
      {
        icon: Settings,
        labelKey: "sidebar.menu.settings",
        href: "/settings",
      },
    ],
  },
];

// AppSidebar props
interface AppSidebarProps {
  variant?: "sidebar" | "floating" | "inset";
  /** Legacy role (display only; menu gating uses permissions). */
  role?: "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null;
  user?: {
    name: string | null;
    email: string;
  };
}

export function AppSidebar({ variant = "sidebar", user }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const { can } = useSafePermissions();

  const menuItems: MenuSection[] = useMemo(
    () =>
      menuConfig.map((section) => ({
        group: section.groupKey ? t(section.groupKey) : null,
        color: section.color,
        items: section.items.map((item) => ({
          ...item,
          label: t(item.labelKey),
        })),
      })),
    [t]
  );

  // Check whether the current path matches a menu item
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return (
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/") ||
        pathname === "/"
      );
    }
    // Subscriptions menu: /apps paths also activate it
    if (href === "/subscriptions") {
      return (
        pathname.startsWith("/subscriptions") || pathname.startsWith("/apps")
      );
    }
    // Settings stays inactive on the Master data hub, which has its own entry
    if (href === "/settings") {
      return (
        pathname.startsWith("/settings") &&
        !pathname.startsWith("/settings/masters")
      );
    }
    // Organization menu: active for /teams, /users and /org paths
    if (href === "/teams") {
      return (
        pathname.startsWith("/teams") ||
        pathname.startsWith("/users") ||
        pathname.startsWith("/org")
      );
    }
    return pathname.startsWith(href);
  };

  // Permission-based gating (pages and actions re-check on the server). While
  // the permission set loads, gated entries stay hidden.
  const filteredMenuItems = menuItems
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          !item.permissionAny || item.permissionAny.some((key) => can(key))
      ),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <Sidebar data-testid="app-sidebar" variant={variant}>
      {/* Logo + brand header - aligned with AppHeader (55px) + SidebarInset top margin (8px) */}
      <SidebarHeader className="h-16 justify-center px-5 py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-12 px-0 hover:bg-transparent active:bg-transparent"
            >
              <Link href="/dashboard" className="flex items-center">
                <SubHubLogo className="group-data-[collapsible=icon]:[&>span]:hidden" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Menu content - no horizontal padding (keeps the scrollbar aligned) */}
      <SidebarContent className="px-0">
        <ScrollArea className="h-full">
          {filteredMenuItems.map((section, sectionIndex) => (
            <SidebarGroup
              key={section.group ?? `section-${sectionIndex}`}
              className={
                sectionIndex === 0 ? "py-1 pr-4 pl-0" : "pt-5 pr-4 pb-1 pl-0"
              }
            >
              {section.group && (
                <SidebarGroupLabel className="text-disabled-foreground h-auto px-0 py-1.5 text-[0.8125rem] font-normal tracking-normal normal-case group-data-[collapsible=icon]:opacity-0">
                  <div className="flex w-full items-center gap-2.5">
                    <span
                      aria-hidden
                      className="bg-border h-px w-3.5 shrink-0"
                    />
                    <span className="shrink-0">{section.group}</span>
                    <span aria-hidden className="bg-border h-px flex-1" />
                  </div>
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon as React.ComponentType<{
                      className?: string;
                      style?: React.CSSProperties;
                    }>;
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.href)}
                          tooltip={item.label}
                          className={
                            isActive(item.href)
                              ? "nav-active mt-1.5 h-[42px] rounded-l-none rounded-r-full pr-3.5 pl-[22px] text-[0.9375rem] font-normal hover:text-white data-[active=true]:text-white"
                              : "text-sidebar-foreground hover:bg-sidebar-accent mt-1.5 h-[42px] rounded-l-none rounded-r-full pr-3.5 pl-[22px] text-[0.9375rem] font-normal"
                          }
                        >
                          <Link
                            href={item.href}
                            data-active={isActive(item.href)}
                          >
                            <Icon className="size-[1.375rem] shrink-0 stroke-[1.75]" />
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <SidebarMenuBadge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {item.badge}
                              </SidebarMenuBadge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>

      <SidebarSeparator className="mx-5 w-auto" />

      {/* Bottom profile area */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-[38px]">
                    <AvatarFallback className="tonal-primary text-sm font-medium">
                      {(user?.name ?? user?.email ?? "U")
                        .charAt(0)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                    <span className="w-full truncate text-[0.9375rem] font-medium">
                      {user?.name ?? t("sidebar.user.fallbackName")}
                    </span>
                    <span className="text-muted-foreground w-full truncate text-[0.8125rem]">
                      {user?.email ?? "user@example.com"}
                    </span>
                  </div>
                  <MoreHorizontal className="text-muted-foreground h-4 w-4 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile" className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>{t("common.profile")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t("common.settings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("common.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
