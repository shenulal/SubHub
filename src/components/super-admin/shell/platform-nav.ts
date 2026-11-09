// src/components/super-admin/shell/platform-nav.ts
/** Control Panel navigation (platform areas only — no tenant workspace links). */
import {
  BarChart3,
  Box,
  Building2,
  Database,
  KeyRound,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface PlatformNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Keeps the selected `?org=` (SaaS screens that work on one tenant). */
  tenantScoped?: boolean;
}

export interface PlatformNavGroup {
  label: string;
  items: PlatformNavItem[];
}

export function platformNavGroups(multiTenant: boolean): PlatformNavGroup[] {
  const tenancy: PlatformNavItem = multiTenant
    ? { href: "/super-admin/tenants", label: "Tenants", icon: Building2 }
    : {
        href: "/super-admin/installation",
        label: "Installation",
        icon: Server,
      };
  return [
    {
      label: "Overview",
      items: [
        {
          href: "/super-admin",
          label: "Analytics",
          icon: BarChart3,
          tenantScoped: true,
        },
      ],
    },
    {
      label: "Tenancy",
      items: [
        tenancy,
        {
          href: "/super-admin/admins",
          label: "Tenant admins",
          icon: UserCog,
          tenantScoped: true,
        },
        {
          href: "/super-admin/extension-builds",
          label: "Extension builds",
          icon: Box,
          tenantScoped: true,
        },
      ],
    },
    {
      label: "Platform",
      items: [
        {
          href: "/super-admin/platform-admins",
          label: "Platform admins",
          icon: ShieldCheck,
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
        { href: "/super-admin/licence", label: "Licence", icon: KeyRound },
        { href: "/super-admin/audit", label: "Audit log", icon: ScrollText },
      ],
    },
  ];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/super-admin") return pathname === "/super-admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
