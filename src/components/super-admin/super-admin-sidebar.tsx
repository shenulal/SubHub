// src/components/super-admin/super-admin-sidebar.tsx
"use client";

import type { DeploymentInfo } from "@/lib/deployment/mode";
import { cn } from "@/lib/utils";
import {
  Box,
  Building2,
  Database,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DeploymentModeBadge } from "./deployment-mode-badge";

/** Screens that work on one tenant keep the selected `?org=` (SaaS). */
const TENANT_SCOPED = new Set([
  "/super-admin",
  "/super-admin/tenant",
  "/super-admin/admins",
  "/super-admin/extension-builds",
]);

const baseNavItems = [
  {
    href: "/super-admin",
    label: "Usage Overview",
    icon: LayoutDashboard,
  },
  {
    href: "/super-admin/tenant",
    label: "Tenant Settings",
    icon: Building2,
  },
  {
    href: "/super-admin/admins",
    label: "Admin Management",
    icon: Users,
  },
  {
    href: "/super-admin/extension-builds",
    label: "Extension Builds",
    icon: Box,
  },
  {
    href: "/super-admin/masters",
    label: "Platform masters",
    icon: Database,
  },
  {
    href: "/super-admin/settings",
    label: "Platform settings",
    icon: Settings,
  },
];

export function SuperAdminSidebar({
  deployment,
}: {
  deployment: DeploymentInfo;
}) {
  const pathname = usePathname();
  const org = useSearchParams().get("org");
  const navItems = baseNavItems.map((item) => ({
    ...item,
    label:
      item.href === "/super-admin/tenant" && deployment.multiTenant
        ? "Tenants"
        : item.label,
    href:
      org && deployment.multiTenant && TENANT_SCOPED.has(item.href)
        ? `${item.href}?org=${encodeURIComponent(org)}`
        : item.href,
    path: item.href,
  }));

  return (
    <aside className="bg-background flex w-full shrink-0 flex-col max-lg:border-b lg:h-screen lg:w-[260px]">
      {/* Header */}
      <div className="flex min-w-0 items-center gap-3 px-5 py-4 lg:py-5">
        <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-md shadow-xs">
          <Shield className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-foreground truncate text-[0.9375rem] font-medium">
            Super Admin
          </p>
          <p className="text-muted-foreground truncate text-[0.8125rem]">
            Admin Console
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-2 lg:pr-4 lg:pl-0">
        {navItems.map((item) => {
          const isActive =
            item.path === "/super-admin"
              ? pathname === "/super-admin"
              : pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              href={item.href}
              className={cn(
                "flex h-[42px] shrink-0 items-center gap-2.5 rounded-full px-4 text-[0.9375rem] whitespace-nowrap transition-colors lg:rounded-l-none lg:pl-6",
                isActive
                  ? "nav-active"
                  : "text-foreground/90 hover:bg-foreground/[0.06]"
              )}
            >
              <item.icon className="size-[22px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Deployment mode (SUBHUB_DEPLOYMENT_MODE, read-only) */}
      <div className="hidden px-4 pb-3 lg:block">
        <DeploymentModeBadge deployment={deployment} />
      </div>

      {/* Sign out */}
      <div className="px-4 pb-3 lg:border-t lg:p-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-foreground/90 hover:bg-error/10 hover:text-error flex h-[42px] w-full items-center gap-2.5 rounded-md px-3 text-[0.9375rem] transition-colors"
        >
          <LogOut className="size-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
