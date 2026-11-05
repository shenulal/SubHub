"use client";

import {
  AppWindow,
  BarChart3,
  CalendarClock,
  DollarSign,
  FileText,
  Globe,
  LucideIcon,
  ShieldOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface ReportsMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
}

const reportsMenuConfig = [
  {
    icon: DollarSign,
    labelKey: "sidebar.menu.reports.cost",
    descriptionKey: "sidebar.menu.reports.costDescription",
    href: "/reports/cost",
  },
  {
    icon: CalendarClock,
    labelKey: "sidebar.menu.reports.renewal",
    descriptionKey: "sidebar.menu.reports.renewalDescription",
    href: "/reports/renewal",
  },
  {
    icon: BarChart3,
    labelKey: "sidebar.menu.reports.usage",
    descriptionKey: "sidebar.menu.reports.usageDescription",
    href: "/reports/usage",
  },
  {
    icon: Globe,
    labelKey: "sidebar.menu.reports.browsingUsage",
    descriptionKey: "sidebar.menu.reports.browsingUsageDescription",
    href: "/reports/browsing-usage",
  },
  {
    icon: AppWindow,
    labelKey: "sidebar.menu.reports.registeredAppUsage",
    descriptionKey: "sidebar.menu.reports.registeredAppUsageDescription",
    href: "/reports/registered-app-usage",
  },
  {
    icon: ShieldOff,
    labelKey: "sidebar.menu.reports.blockEvents",
    descriptionKey: "sidebar.menu.reports.blockEventsDescription",
    href: "/reports/block-events",
  },
  {
    icon: FileText,
    labelKey: "sidebar.menu.reports.audit",
    descriptionKey: "sidebar.menu.reports.auditDescription",
    href: "/reports/audit",
  },
];

export function ReportsSidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  const menuItems: ReportsMenuItem[] = useMemo(
    () =>
      reportsMenuConfig.map((item) => ({
        icon: item.icon,
        label: t(item.labelKey),
        href: item.href,
        description: item.descriptionKey ? t(item.descriptionKey) : undefined,
      })),
    [t]
  );

  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
      {menuItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
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
