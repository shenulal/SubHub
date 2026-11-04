// src/components/layouts/workspace-scope-switch.tsx
"use client";

/**
 * Segmented "Workspace | Personal" switch (6.4). Rendered only when the
 * organisation allows personal subscriptions.
 */
import { useWorkspaceScope } from "@/hooks/use-workspace-scope";
import { cn } from "@/lib/utils";
import type { WorkspaceScope } from "@/types/discovery";
import { Building2, Loader2, User } from "lucide-react";
import { useTranslations } from "next-intl";

const OPTIONS: Array<{ value: WorkspaceScope; icon: typeof Building2 }> = [
  { value: "workspace", icon: Building2 },
  { value: "personal", icon: User },
];

export function WorkspaceScopeSwitch({ className }: { className?: string }) {
  const t = useTranslations("discovery.scope");
  const { scope, allowPersonal, hydrated, isPending, setScope } =
    useWorkspaceScope();

  if (!hydrated || !allowPersonal) return null;

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      data-testid="workspace-scope-switch"
      className={cn(
        "bg-muted inline-flex h-8 items-center rounded-full p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, icon: Icon }) => {
        const active = scope === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={isPending}
            onClick={() => !active && void setScope(value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isPending && active ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
