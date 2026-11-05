"use client";

import {
  Bell,
  BellRing,
  Building2,
  CheckSquare,
  Database,
  FolderTree,
  KeyRound,
  ListPlus,
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

import { cn } from "@/lib/utils";

interface SettingsMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  description?: string;
  adminOnly?: boolean;
}

const settingsMenuConfig = [
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
    adminOnly: true,
  },
  {
    icon: Users,
    labelKey: "settings.sidebar.team.title",
    descriptionKey: "settings.sidebar.team.description",
    href: "/settings/team",
    adminOnly: true,
  },
  {
    icon: Wallet,
    labelKey: "settings.sidebar.budget.title",
    descriptionKey: "settings.sidebar.budget.description",
    href: "/settings/budget",
    adminOnly: true,
  },
  {
    icon: SlidersHorizontal,
    labelKey: "platform.sidebar.workspace.title",
    descriptionKey: "platform.sidebar.workspace.description",
    href: "/settings/workspace",
    adminOnly: true,
  },
  {
    icon: Database,
    labelKey: "platform.sidebar.masters.title",
    descriptionKey: "platform.sidebar.masters.description",
    href: "/settings/masters",
    adminOnly: true,
  },
  {
    icon: KeyRound,
    labelKey: "platform.sidebar.roles.title",
    descriptionKey: "platform.sidebar.roles.description",
    href: "/settings/roles",
    adminOnly: true,
  },
  {
    icon: BellRing,
    labelKey: "platform.sidebar.templates.title",
    descriptionKey: "platform.sidebar.templates.description",
    href: "/settings/notification-templates",
    adminOnly: true,
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
  },
  {
    icon: CheckSquare,
    labelKey: "settings.sidebar.approvals.title",
    descriptionKey: "settings.sidebar.approvals.description",
    href: "/settings/approvals",
    adminOnly: true,
  },
  {
    icon: FolderTree,
    labelKey: "settings.sidebar.taxonomy.title",
    descriptionKey: "settings.sidebar.taxonomy.description",
    href: "/settings/taxonomy",
    adminOnly: true,
  },
  {
    icon: ListPlus,
    labelKey: "settings.sidebar.customFields.title",
    descriptionKey: "settings.sidebar.customFields.description",
    href: "/settings/custom-fields",
    adminOnly: true,
  },
  {
    icon: Mail,
    labelKey: "settings.sidebar.mailboxes.title",
    descriptionKey: "settings.sidebar.mailboxes.description",
    href: "/settings/mailboxes",
  },
  {
    icon: ShieldCheck,
    labelKey: "settings.sidebar.privacy.title",
    descriptionKey: "settings.sidebar.privacy.description",
    href: "/settings/privacy",
  },
];

interface SettingsSidebarProps {
  isAdmin?: boolean;
}

export function SettingsSidebar({ isAdmin = false }: SettingsSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const settingsMenuItems: SettingsMenuItem[] = useMemo(
    () =>
      settingsMenuConfig.map((item) => ({
        icon: item.icon,
        label: t(item.labelKey),
        href: item.href,
        description: item.descriptionKey ? t(item.descriptionKey) : undefined,
        adminOnly: item.adminOnly,
      })),
    [t]
  );

  return (
    <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
      {settingsMenuItems.map((item) => {
        // 관리자 전용 항목 처리
        if (item.adminOnly && !isAdmin) {
          return null;
        }

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
