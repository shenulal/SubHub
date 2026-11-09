"use client";

/**
 * SectionLayout — the shared "title + sub-menu card + content card" frame used
 * by Settings, Extensions, Payments, Subscriptions, Reports and Org.
 *
 * Scroll behaviour (the reason this is a client component):
 * - From the breakpoint up the menu is sticky and fits the viewport with its
 *   own scroll area, so every item is reachable without scrolling the page and
 *   the menu keeps its own scroll position from page to page.
 * - Sub-menu links use `scroll={false}` (see `SECTION_NAV_LINK_PROPS`), so a
 *   click no longer jumps the page to the top. Instead, after navigation the
 *   page scrolls up only when the top of the new content is hidden, and then
 *   only far enough to show it under the sticky header — the menu stays put.
 * - The active item is kept visible inside the menu's own scroll area (vertical
 *   on desktop, horizontal chips on smaller screens) without moving the page.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { revealWithinScrollParents } from "./reveal-within-scroll-parents";

export type SectionBreakpoint = "xl" | "2xl";

/**
 * Static class sets per breakpoint (Tailwind needs literal class names).
 * The menu height is capped at the viewport minus the space above it (sticky
 * header 4rem + page padding + section title + gaps ≈ 11rem, plus a 1rem bottom
 * margin), so the whole card is on screen at the top of the page and the user
 * never has to scroll the page to reach a menu item.
 */
const LAYOUT_CLASSES: Record<
  SectionBreakpoint,
  { row: string; aside: string; menu: string }
> = {
  xl: {
    row: "xl:flex-row xl:items-start",
    aside: "xl:sticky xl:top-20 xl:w-[260px] xl:shrink-0",
    menu: "xl:max-h-[calc(100svh-12rem)] xl:overflow-y-auto",
  },
  "2xl": {
    row: "2xl:flex-row 2xl:items-start",
    aside: "2xl:sticky 2xl:top-20 2xl:w-[260px] 2xl:shrink-0",
    menu: "2xl:max-h-[calc(100svh-12rem)] 2xl:overflow-y-auto",
  },
};

/** Props every sub-menu `<Link>` spreads so navigation keeps the page still. */
export const SECTION_NAV_LINK_PROPS = { scroll: false } as const;

interface SectionLayoutProps {
  title: ReactNode;
  /** The section's sub-menu (a `<nav>` of links). */
  nav: ReactNode;
  children: ReactNode;
  /** Width from which the menu sits beside the content. */
  breakpoint?: SectionBreakpoint;
}

export function SectionLayout({
  title,
  nav,
  children,
  breakpoint = "xl",
}: SectionLayoutProps) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const classes = LAYOUT_CLASSES[breakpoint];

  // Keep the active item visible inside the menu (first load and every change).
  useEffect(() => {
    const menu = menuRef.current;
    const active = menu?.querySelector<HTMLElement>('[aria-current="page"]');
    if (menu && active) revealWithinScrollParents(active, menu);
  }, [pathname]);

  // After a sub-menu click, show the top of the new content if it is hidden.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const content = contentRef.current;
    if (!content) return;
    const offset = parseFloat(getComputedStyle(content).scrollMarginTop) || 0;
    if (content.getBoundingClientRect().top < offset) {
      content.scrollIntoView({ block: "start" });
    }
  }, [pathname]);

  return (
    <div className="space-y-5">
      <div className="space-y-0.5">
        <h2 className="text-foreground text-2xl leading-tight font-medium">
          {title}
        </h2>
      </div>

      <div className={cn("flex min-w-0 flex-col gap-6", classes.row)}>
        <aside className={cn("min-w-0", classes.aside)}>
          <Card ref={menuRef} className={cn("gap-0 p-2", classes.menu)}>
            {nav}
          </Card>
        </aside>

        {/* scroll-mt-20 matches the sticky header + gap (top-20 above). */}
        <main ref={contentRef} className="min-w-0 flex-1 scroll-mt-20">
          <Card className="min-w-0 gap-0 p-5 sm:p-6">{children}</Card>
        </main>
      </div>
    </div>
  );
}
