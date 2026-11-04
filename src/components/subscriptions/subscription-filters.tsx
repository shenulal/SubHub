// src/components/subscriptions/subscription-filters.tsx
"use client";

/**
 * Filter bar for the subscription list (9.2 / 9.3). Fully controlled: the page
 * owns the state (mirrored in the URL) and this component only emits patches.
 */
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
import {
  MultiSelectPopover,
  SingleSelectPopover,
} from "./subscription-filters-shared";

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

/** Two-level category list flattened for a single-select popover. */
function flattenCategories(tree: CategoryOption[]): NamedOption[] {
  return tree.flatMap((parent) => [
    { id: parent.id, name: parent.name, color: parent.color },
    ...(parent.children ?? []).map((c) => ({
      id: c.id,
      name: `${parent.name} › ${c.name}`,
      color: c.color,
    })),
  ]);
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

  const statusOptions = useMemo<NamedOption[]>(
    () => STATUS_OPTIONS.map((s) => ({ id: s, name: ts(s.toLowerCase()) })),
    [ts]
  );
  const categoryOptions = useMemo(
    () => flattenCategories(options.categories),
    [options.categories]
  );
  const parentIds = useMemo(
    () => new Set(options.categories.map((c) => c.id)),
    [options.categories]
  );

  const activeCount = countActiveFilters(filter);
  const advancedCount = countActiveFilters({
    ownerId: filter.ownerId,
    teamId: filter.teamId,
    costCenterId: filter.costCenterId,
    paymentMethodId: filter.paymentMethodId,
    billingCycle: filter.billingCycle,
    amountMin: filter.amountMin,
    amountMax: filter.amountMax,
    renewingWithinDays: filter.renewingWithinDays,
    trialOnly: filter.trialOnly,
    includeArchived: filter.includeArchived,
  });

  const categoryValue = filter.categoryId ?? filter.parentCategoryId;
  const handleCategory = (id: string | undefined) => {
    if (!id)
      return onFilterChange({
        categoryId: undefined,
        parentCategoryId: undefined,
      });
    if (parentIds.has(id)) {
      return onFilterChange({ parentCategoryId: id, categoryId: undefined });
    }
    onFilterChange({ categoryId: id, parentCategoryId: undefined });
  };

  const SortIcon = sort.sortOrder === "asc" ? ArrowUpAZ : ArrowDownAZ;

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      data-testid="subscription-filters"
    >
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-8 w-56 pl-8 text-sm"
        />
        {search && (
          <button
            type="button"
            aria-label={t("clear")}
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <MultiSelectPopover
        label={t("status")}
        options={statusOptions}
        selected={filter.statuses ?? []}
        onChange={(ids) =>
          onFilterChange({
            statuses: ids.length ? (ids as SubscriptionStatus[]) : undefined,
            includeArchived: ids.includes("ARCHIVED")
              ? true
              : filter.includeArchived,
          })
        }
      />
      <SingleSelectPopover
        label={t("category")}
        options={categoryOptions}
        value={categoryValue}
        onChange={handleCategory}
      />
      <MultiSelectPopover
        label={t("tags")}
        options={options.tags}
        selected={filter.tagIds ?? []}
        onChange={(ids) =>
          onFilterChange({ tagIds: ids.length ? ids : undefined })
        }
        showColor
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
          className="text-muted-foreground h-8 px-2 text-xs"
          onClick={onReset}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          {t("reset", { count: activeCount })}
        </Button>
      )}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 gap-1.5 font-normal")}
              aria-label={tSort("label")}
            >
              <SortIcon className="h-3.5 w-3.5" />
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
