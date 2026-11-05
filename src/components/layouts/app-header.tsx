"use client";

import { LogOut, Settings, User } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { logout } from "@/actions/auth";
import { CommandSearch } from "@/components/common/command-search";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { NotificationBell } from "@/components/layouts/notification-bell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

export function AppHeader() {
  const t = useTranslations();
  // Materio navbar: transparent at rest, paper surface + shadow once the page scrolls
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="app-header"
      data-scrolled={isScrolled}
      className="sticky top-0 z-50 mx-auto w-full max-w-[1440px] shrink-0 px-4 pt-0 sm:px-6"
    >
      <div
        className={
          "flex h-16 items-center gap-2 px-2 transition-[background-color,box-shadow,border-radius,padding] duration-200 " +
          (isScrolled
            ? "bg-card/90 rounded-b-lg px-4 shadow-sm backdrop-blur-md"
            : "bg-transparent")
        }
      >
        {/* Sidebar toggle */}
        <SidebarTrigger className="-ml-1" />

        <Separator
          orientation="vertical"
          className="mr-2 hidden !h-4 sm:block"
        />

        {/* Command+K search */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CommandSearch />
        </div>

        {/* Right-side actions */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {/* Notification bell */}
          <NotificationBell />

          {/* Theme toggle (7.4 dark mode) */}
          <ThemeToggle />

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex"
            aria-label={t("common.settings")}
            asChild
          >
            <Link href="/settings">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>

          <Separator
            orientation="vertical"
            className="mx-2 hidden !h-4 sm:block"
          />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                data-testid="user-menu-trigger"
              >
                <Avatar className="ring-card size-[38px] shadow-xs ring-2">
                  <AvatarFallback className="tonal-primary">
                    <User className="h-[18px] w-[18px]" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  {t("common.profile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  {t("common.settings")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onSelect={async (e) => {
                  e.preventDefault();
                  await logout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
