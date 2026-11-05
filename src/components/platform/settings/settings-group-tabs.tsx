"use client";

import { cn } from "@/lib/utils";
import type { SettingsGroupMeta } from "@/types/platform";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsGroupTabsProps {
  groups: SettingsGroupMeta[];
  basePath?: string;
}

/** Horizontal (wrapping) pill navigation for the workspace settings pages. */
export function SettingsGroupTabs({
  groups,
  basePath = "/settings/workspace",
}: SettingsGroupTabsProps) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings groups" className="mb-6 min-w-0">
      <ul className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const href = `${basePath}/${group.key}`;
          const active = pathname === href;
          return (
            <li key={group.key} className="min-w-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                title={group.description}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex h-[38px] items-center rounded-md px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-foreground hover:bg-primary/10 hover:text-primary"
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
