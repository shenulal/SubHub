// src/components/super-admin/super-admin-sidebar.tsx
"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  Box,
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/super-admin",
    label: "사용 현황",
    icon: LayoutDashboard,
  },
  {
    href: "/super-admin/tenant",
    label: "테넌트 설정",
    icon: Building2,
  },
  {
    href: "/super-admin/admins",
    label: "관리자 관리",
    icon: Users,
  },
  {
    href: "/super-admin/extension-builds",
    label: "Extension 빌드",
    icon: Box,
  },
  {
    href: "/super-admin/settings",
    label: "Platform settings",
    icon: Settings,
  },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-background flex w-full shrink-0 flex-col max-lg:border-b lg:h-screen lg:w-[260px]">
      {/* 헤더 */}
      <div className="flex min-w-0 items-center gap-3 px-5 py-4 lg:py-5">
        <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-md shadow-xs">
          <Shield className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-foreground truncate text-[0.9375rem] font-medium">
            Super Admin
          </p>
          <p className="text-muted-foreground truncate text-[0.8125rem]">
            관리 콘솔
          </p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:py-2 lg:pr-4 lg:pl-0">
        {navItems.map((item) => {
          const isActive =
            item.href === "/super-admin"
              ? pathname === "/super-admin"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
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

      {/* 통계 배지 */}
      <div className="hidden px-4 pb-3 lg:block">
        <div className="tonal-neutral flex items-center gap-2 rounded-md px-3 py-2">
          <BarChart3 className="size-4 shrink-0" />
          <span className="truncate text-xs font-medium">
            PHASE 1 (단일 테넌트)
          </span>
        </div>
      </div>

      {/* 로그아웃 */}
      <div className="px-4 pb-3 lg:border-t lg:p-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-foreground/90 hover:bg-error/10 hover:text-error flex h-[42px] w-full items-center gap-2.5 rounded-md px-3 text-[0.9375rem] transition-colors"
        >
          <LogOut className="size-5" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
