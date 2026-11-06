"use client";

/**
 * Control Panel sidebar — always dark (scoped `.dark` tokens) so the platform
 * console never looks like a tenant workspace. Horizontal bar below `lg`.
 */
import type { DeploymentInfo } from "@/lib/deployment/mode";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DeploymentModeBadge } from "../deployment-mode-badge";
import { PlatformBrand } from "./platform-brand";
import {
  isNavItemActive,
  platformNavGroups,
  type PlatformNavItem,
} from "./platform-nav";
import { PlatformSignOutButton } from "./platform-sign-out-button";

export interface PlatformOperator {
  name: string | null;
  email: string;
}

function NavLink({
  item,
  href,
  active,
}: {
  item: PlatformNavItem;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-[0.9375rem] whitespace-nowrap transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "nav-active"
          : "text-foreground/80 hover:bg-foreground/[0.08] hover:text-foreground"
      )}
    >
      <item.icon className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

function OperatorCard({ operator }: { operator: PlatformOperator }) {
  const initial = (operator.name ?? operator.email).charAt(0).toUpperCase();
  return (
    <div className="bg-foreground/[0.06] flex min-w-0 items-center gap-3 rounded-md p-2.5">
      <span className="tonal-primary flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {initial}
      </span>
      <div className="min-w-0">
        <p
          className="text-foreground truncate text-[0.875rem] font-medium"
          title={operator.name ?? undefined}
        >
          {operator.name ?? "Platform admin"}
        </p>
        <p
          className="text-muted-foreground truncate text-[0.75rem]"
          title={operator.email}
        >
          {operator.email}
        </p>
      </div>
    </div>
  );
}

export function PlatformSidebar({
  deployment,
  operator,
}: {
  deployment: DeploymentInfo;
  operator: PlatformOperator;
}) {
  const pathname = usePathname();
  const org = useSearchParams().get("org");
  const groups = platformNavGroups(deployment.multiTenant);
  const hrefFor = (item: PlatformNavItem) =>
    org && deployment.multiTenant && item.tenantScoped
      ? `${item.href}?org=${encodeURIComponent(org)}`
      : item.href;

  return (
    <aside
      data-testid="platform-sidebar"
      className="dark bg-card text-foreground flex w-full shrink-0 flex-col shadow-md lg:h-screen lg:w-[264px]"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-4 lg:py-5">
        <PlatformBrand />
        <PlatformSignOutButton className="lg:hidden" label="" />
      </div>
      <nav
        aria-label="Control Panel"
        className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:pt-2"
      >
        {groups.map((group) => (
          <div key={group.label} className="flex shrink-0 gap-1 lg:flex-col">
            <p className="text-muted-foreground hidden px-3 pb-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase lg:block">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                href={hrefFor(item)}
                active={isNavItemActive(pathname, item.href)}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="border-foreground/10 hidden flex-col gap-3 border-t p-4 lg:flex">
        <DeploymentModeBadge deployment={deployment} />
        <OperatorCard operator={operator} />
        <PlatformSignOutButton className="w-full" />
      </div>
    </aside>
  );
}
