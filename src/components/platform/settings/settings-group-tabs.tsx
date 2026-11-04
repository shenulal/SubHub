"use client";

import { cn } from "@/lib/utils";
import type { SettingsGroupMeta } from "@/types/platform";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsGroupTabsProps {
  groups: SettingsGroupMeta[];
  basePath?: string;
}

/** Horizontal, scrollable group navigation for the workspace settings pages. */
export function SettingsGroupTabs({
  groups,
  basePath = "/settings/workspace",
}: SettingsGroupTabsProps) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings groups"
      className="-mx-6 mb-6 overflow-x-auto border-b px-6"
    >
      <ul className="flex min-w-max gap-1">
        {groups.map((group) => {
          const href = `${basePath}/${group.key}`;
          const active = pathname === href;
          return (
            <li key={group.key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={group.description}
                className={cn(
                  "-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:border-border border-transparent"
                )}
              >
                {group.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
