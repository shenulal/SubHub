"use client";

import {
  Activity,
  AppWindow,
  BarChart3,
  ClipboardList,
  Download,
  LucideIcon,
  Mail,
  ShieldOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

interface ExtensionsMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
}

const extensionsMenuConfig = [
  {
    icon: BarChart3,
    labelKey: "sidebar.menu.extensions.usage",
    descriptionKey: "sidebar.menu.extensions.usageDescription",
    href: "/extensions/usage",
  },
  {
    icon: ClipboardList,
    labelKey: "sidebar.menu.extensions.reviewApps",
    descriptionKey: "sidebar.menu.extensions.reviewAppsDescription",
    href: "/extensions/review-apps",
  },
  {
    icon: AppWindow,
    labelKey: "sidebar.menu.extensions.registeredApps",
    descriptionKey: "sidebar.menu.extensions.registeredAppsDescription",
    href: "/extensions/registered-apps",
  },
  {
    icon: ShieldOff,
    labelKey: "sidebar.menu.extensions.blockedApps",
    descriptionKey: "sidebar.menu.extensions.blockedAppsDescription",
    href: "/extensions/blocked-apps",
  },
  {
    icon: Mail,
    labelKey: "sidebar.menu.extensions.onboarding",
    descriptionKey: "sidebar.menu.extensions.onboardingDescription",
    href: "/extensions/onboarding",
  },
  {
    icon: Activity,
    labelKey: "sidebar.menu.extensions.status",
    descriptionKey: "sidebar.menu.extensions.statusDescription",
    href: "/extensions/status",
  },
  {
    icon: Download,
    labelKey: "sidebar.menu.extensions.builds",
    descriptionKey: "sidebar.menu.extensions.buildsDescription",
    href: "/extensions/builds",
  },
];

export function ExtensionsSidebar() {
  const pathname = usePathname();
  const t = useTranslations();

  const menuItems: ExtensionsMenuItem[] = useMemo(
    () =>
      extensionsMenuConfig.map((item) => ({
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
              <span className="truncate" title={item.label}>
                {item.label}
              </span>
              {item.description && (
                <span
                  className="text-muted-foreground hidden truncate text-[0.8125rem] font-normal xl:block"
                  title={item.description}
                >
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
