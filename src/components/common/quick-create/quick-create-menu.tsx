// src/components/common/quick-create/quick-create-menu.tsx
"use client";

/**
 * Navbar "+ New" button. Lists only what the viewer may create; "N" opens it
 * from anywhere except while typing in a field.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSafePermissions } from "@/hooks/use-permission-flag";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useQuickCreate } from "./quick-create-context";
import { allowedQuickCreateEntries } from "./quick-create-registry";

const SHORTCUT_KEY = "n";

/** True when a key press should be left to the focused control. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return Boolean(target.closest("[role=dialog], [role=listbox], [role=menu]"));
}

export function QuickCreateMenu() {
  const t = useTranslations("shell.quickCreate");
  const { can, isLoading } = useSafePermissions();
  const quickCreate = useQuickCreate();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const entries = allowedQuickCreateEntries((p) => can(p));
  const hasEntries = entries.length > 0;

  useEffect(() => {
    if (!hasEntries) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== SHORTCUT_KEY) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasEntries]);

  if (isLoading || !hasEntries) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          className="h-9 gap-1.5 px-3"
          aria-label={t("buttonLabel")}
          aria-keyshortcuts="N"
          data-testid="quick-create-trigger"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">{t("button")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-muted-foreground flex items-center justify-between text-xs font-medium tracking-wide uppercase">
          {t("menuLabel")}
          <kbd className="tonal-neutral rounded px-1.5 font-sans text-[0.6875rem]">
            {t("shortcut")}
          </kbd>
        </DropdownMenuLabel>
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <DropdownMenuItem
              key={entry.kind}
              className="cursor-pointer gap-3 py-2"
              onSelect={() =>
                quickCreate
                  ? quickCreate.open(entry.kind)
                  : router.push(entry.href ?? entry.manageHref)
              }
            >
              <span className="tonal-primary flex size-7 shrink-0 items-center justify-center rounded-md">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 truncate">
                {t(`items.${entry.kind}`)}
              </span>
              {entry.href && (
                <DropdownMenuShortcut aria-hidden>↗</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
