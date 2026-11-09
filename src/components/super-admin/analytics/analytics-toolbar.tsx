"use client";

// src/components/super-admin/analytics/analytics-toolbar.tsx
/**
 * Analytics filters kept in the URL: organisation scope (`?org=`, SaaS only —
 * "All organisations" removes it) and period (`?period=`, tokens from settings).
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PeriodOption } from "@/types/platform-analytics";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export const ALL_ORGANIZATIONS = "__all";

export interface ScopeOption {
  id: string;
  name: string;
  deactivated?: boolean;
}

interface AnalyticsToolbarProps {
  /** Omit in single-tenant mode (one organisation, no scope picker). */
  organizations?: ScopeOption[];
  selectedOrganization?: string;
  period: string;
  periodOptions: PeriodOption[];
}

const PERIOD_ITEM =
  "text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-primary h-8 shrink-0 rounded-sm px-3 text-[0.8125rem] whitespace-nowrap data-[state=on]:font-medium data-[state=on]:shadow-xs";

export function AnalyticsToolbar({
  organizations,
  selectedOrganization,
  period,
  periodOptions,
}: AnalyticsToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = (key: "org" | "period", value: string | null) => {
    const next = new URLSearchParams(searchParams?.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() =>
      router.push(query ? `${pathname}?${query}` : pathname)
    );
  };

  return (
    <div
      className="flex min-w-0 flex-wrap items-center justify-between gap-3"
      data-testid="analytics-toolbar"
      aria-busy={isPending}
    >
      {organizations ? (
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-muted-foreground shrink-0 text-[0.8125rem] font-medium">
            Organisation
          </span>
          <Select
            value={selectedOrganization ?? ALL_ORGANIZATIONS}
            onValueChange={(id) =>
              navigate("org", id === ALL_ORGANIZATIONS ? null : id)
            }
          >
            <SelectTrigger
              className="w-[260px] max-w-full min-w-0"
              aria-label="Organisation"
            >
              <SelectValue placeholder="All organisations" />
            </SelectTrigger>
            <SelectContent
              searchPlaceholder="Search organisations"
              emptyText="No organisations"
            >
              <SelectItem value={ALL_ORGANIZATIONS}>
                All organisations
              </SelectItem>
              {organizations.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.deactivated ? `${o.name} (suspended)` : o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <span />
      )}
      <ToggleGroup
        type="single"
        value={period}
        onValueChange={(v) => v && navigate("period", v)}
        className="bg-muted max-w-full shrink-0 gap-0 overflow-x-auto rounded-md p-[3px]"
        aria-label="Period"
      >
        {periodOptions.map((o) => (
          <ToggleGroupItem
            key={o.token}
            value={o.token}
            className={PERIOD_ITEM}
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
