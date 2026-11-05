// src/components/subscriptions/subscription-filters.tsx
"use client";

/**
 * Filter bar for the subscription list (9.2 / 9.3). Fully controlled: the page
 * owns the state (mirrored in the URL) and this component only emits patches.
 */
import { FilterMultiSelect } from "@/components/common/filter-multi-select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { MultiSelectOption } from "@/components/ui/multi-select";
import { countActiveFilters } from "@/lib/services/discovery/filter-params";
import { cn } from "@/lib/utils";
import {
  SUBSCRIPTION_SORT_FIELDS,
  type CategoryOption,
  type NamedOption,
  type SubscriptionFilterOptions,
  type SubscriptionListFilter,
  type SubscriptionListSort,
  type SubscriptionSortField,
} from "@/types/discovery";
import type { SubscriptionStatus } from "@prisma/client";
import { ArrowDownAZ, ArrowUpAZ, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { SubscriptionFiltersAdvanced } from "./subscription-filters-advanced";

const STATUS_OPTIONS: SubscriptionStatus[] = [
  "ACTIVE",
  "PENDING",
  "PAUSED",
  "EXPIRED",
  "CANCELLED",
  "ARCHIVED",
];

/** Debounce for the free-text search before it hits the URL. */
const SEARCH_DEBOUNCE_MS = 300;

interface SubscriptionFiltersProps {
  filter: SubscriptionListFilter;
  sort: SubscriptionListSort;
  options: SubscriptionFilterOptions;
  onFilterChange: (patch: Partial<SubscriptionListFilter>) => void;
  onSortChange: (sort: SubscriptionListSort) => void;
  onReset: () => void;
}

function ColorDot({ color }: { color?: string | null }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ background: color ?? "var(--chart-2)" }}
    />
  );
}

/**
 * Two-level category list for the multi-select: each parent heads a group
 * with itself (matches all its subcategories) followed by its children.
 */
function categoryOptions(tree: CategoryOption[]): MultiSelectOption[] {
  return tree.flatMap((parent) => [
    {
      value: parent.id,
      label: parent.name,
      group: parent.name,
      icon: <ColorDot color={parent.color} />,
    },
    ...(parent.children ?? []).map((c) => ({
      value: c.id,
      label: c.name,
      group: parent.name,
      keywords: [parent.name],
      icon: <ColorDot color={c.color} />,
    })),
  ]);
}

function namedOptions(
  options: NamedOption[],
  withColor = false
): MultiSelectOption[] {
  return options.map((o) => ({
    value: o.id,
    label: o.name,
    icon: withColor ? <ColorDot color={o.color} /> : undefined,
  }));
}

export function SubscriptionFilters({
  filter,
  sort,
  options,
  onFilterChange,
  onSortChange,
  onReset,
}: SubscriptionFiltersProps) {
  const t = useTranslations("discovery.filters");
  const ts = useTranslations("subscriptions.status");
  const tSort = useTranslations("discovery.sort");

  const [search, setSearch] = useState(filter.search ?? "");
  useEffect(() => setSearch(filter.search ?? ""), [filter.search]);
  useEffect(() => {
    const next = search.trim() || undefined;
    if (next === (filter.search ?? undefined)) return;
    const handle = setTimeout(
      () => onFilterChange({ search: next }),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const statusOptions = useMemo<MultiSelectOption[]>(
    () => STATUS_OPTIONS.map((s) => ({ value: s, label: ts(s.toLowerCase()) })),
    [ts]
  );
  const categoryChoices = useMemo(
    () => categoryOptions(options.categories),
    [options.categories]
  );
  const tagChoices = useMemo(
    () => namedOptions(options.tags, true),
    [options.tags]
  );

  const activeCount = countActiveFilters(filter);
  const advancedCount = countActiveFilters({
    ownerIds: filter.ownerIds,
    teamIds: filter.teamIds,
    costCenterIds: filter.costCenterIds,
    paymentMethodIds: filter.paymentMethodIds,
    billingCycles: filter.billingCycles,
    amountMin: filter.amountMin,
    amountMax: filter.amountMax,
    renewingWithinDays: filter.renewingWithinDays,
    trialOnly: filter.trialOnly,
    includeArchived: filter.includeArchived,
  });

  const SortIcon = sort.sortOrder === "asc" ? ArrowUpAZ : ArrowDownAZ;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="subscription-filters"
    >
      <div className="relative w-full min-w-0 sm:w-64">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-10 w-full pr-9 pl-9"
        />
        {search && (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <FilterMultiSelect
        label={t("status")}
        options={statusOptions}
        value={filter.statuses ?? []}
        onValueChange={(ids) =>
          onFilterChange({
            statuses: ids.length ? (ids as SubscriptionStatus[]) : undefined,
            includeArchived: ids.includes("ARCHIVED")
              ? true
              : filter.includeArchived,
          })
        }
      />
      <FilterMultiSelect
        label={t("category")}
        options={categoryChoices}
        value={filter.categoryIds ?? []}
        onValueChange={(ids) =>
          onFilterChange({ categoryIds: ids.length ? ids : undefined })
        }
      />
      <FilterMultiSelect
        label={t("tags")}
        options={tagChoices}
        value={filter.tagIds ?? []}
        onValueChange={(ids) =>
          onFilterChange({ tagIds: ids.length ? ids : undefined })
        }
      />
      <SubscriptionFiltersAdvanced
        filter={filter}
        options={options}
        onChange={onFilterChange}
        activeCount={advancedCount}
      />

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary h-10 shrink-0 px-3 whitespace-nowrap"
          onClick={onReset}
        >
          <X className="size-4" />
          {t("reset", { count: activeCount })}
        </Button>
      )}

      <div className="ml-auto shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-10 gap-2 px-4 text-[0.9375rem] font-normal whitespace-nowrap"
              )}
              aria-label={tSort("label")}
            >
              <SortIcon className="size-4" />
              {tSort(sort.sortBy)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">
              {tSort("label")}
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort.sortBy}
              onValueChange={(v) =>
                onSortChange({ ...sort, sortBy: v as SubscriptionSortField })
              }
            >
              {SUBSCRIPTION_SORT_FIELDS.map((field) => (
                <DropdownMenuRadioItem
                  key={field}
                  value={field}
                  className="text-sm"
                >
                  {tSort(field)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                onSortChange({
                  ...sort,
                  sortOrder: sort.sortOrder === "asc" ? "desc" : "asc",
                })
              }
              className="text-sm"
            >
              {sort.sortOrder === "asc"
                ? tSort("descending")
                : tSort("ascending")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
