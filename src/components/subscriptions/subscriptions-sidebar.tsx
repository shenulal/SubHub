// src/components/subscriptions/subscriptions-sidebar.tsx
"use client";

/**
 * Subscriptions sub-navigation: List, Pipeline, Calendar, Receipts,
 * Suggestions, Archived (list preset). Active state is URL-aware so the
 * Archived preset does not light up "List" and vice versa.
 */
import {
  ARCHIVED_PRESET,
  serializeListQuery,
} from "@/lib/services/discovery/filter-params";
import { cn } from "@/lib/utils";
import {
  Archive,
  CalendarDays,
  CreditCard,
  KanbanSquare,
  type LucideIcon,
  Mail,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";

interface NavItem {
  key: string;
  icon: LucideIcon;
  href: string;
  /** Match only when the path (and preset) is exactly this entry. */
  exact?: boolean;
  preset?: "archived";
}

export const ARCHIVED_HREF = `/subscriptions?${serializeListQuery({ filter: ARCHIVED_PRESET }).toString()}`;

const NAV_ITEMS: NavItem[] = [
  { key: "list", icon: CreditCard, href: "/subscriptions", exact: true },
  { key: "pipeline", icon: KanbanSquare, href: "/subscriptions/pipeline" },
  { key: "calendar", icon: CalendarDays, href: "/subscriptions/calendar" },
  { key: "receipts", icon: Mail, href: "/subscriptions/receipts" },
  { key: "suggestions", icon: Sparkles, href: "/subscriptions/suggestions" },
  {
    key: "archived",
    icon: Archive,
    href: ARCHIVED_HREF,
    exact: true,
    preset: "archived",
  },
];

function isArchivedPreset(params: URLSearchParams): boolean {
  return params.get("archived") === "1" && params.get("status") === "ARCHIVED";
}

export function SubscriptionsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("discovery.nav");

  const archivedActive = useMemo(
    () => pathname === "/subscriptions" && isArchivedPreset(searchParams),
    [pathname, searchParams]
  );

  const isActive = (item: NavItem) => {
    if (item.preset === "archived") return archivedActive;
    if (item.exact) return pathname === "/subscriptions" && !archivedActive;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  };

  return (
    <nav
      className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0"
      aria-label={t("label")}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-start gap-3 rounded-md px-3 py-2.5 text-[0.9375rem] leading-snug font-medium transition-colors xl:min-w-0 xl:shrink",
              active
                ? "bg-accent bg-primary/16! text-primary"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Icon className="mt-px size-[18px] shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span>{t(`${item.key}.label`)}</span>
              <span className="text-muted-foreground group-aria-[current=page]:text-primary/75 hidden truncate text-[0.8125rem] font-normal xl:block">
                {t(`${item.key}.description`)}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
