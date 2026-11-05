"use client";

import { FilterMultiSelect } from "@/components/common/filter-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MultiSelectOption } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import * as React from "react";

/**
 * Filter option type
 */
export interface FilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Filter definition type
 */
export interface FilterDefinition {
  id: string;
  title: string;
  options: FilterOption[];
}

/**
 * Selected filter values type
 */
export type SelectedFilters = Record<string, Set<string>>;

/**
 * FacetedFilter Props
 */
interface FacetedFilterProps {
  title: string;
  options: FilterOption[];
  selectedValues: Set<string>;
  onSelectionChange: (values: Set<string>) => void;
}

/**
 * FacetedFilter component - multi-select filter dropdown (shared MultiSelect;
 * an empty selection means "no filter").
 */
function FacetedFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
}: FacetedFilterProps) {
  const items = React.useMemo<MultiSelectOption[]>(
    () =>
      options.map((option) => ({
        value: option.value,
        label: option.label,
        icon: option.icon ? (
          <option.icon className="text-muted-foreground size-4 shrink-0" />
        ) : undefined,
      })),
    [options]
  );
  // Keep the option order so the trigger chips are stable
  const value = React.useMemo(
    () => options.map((o) => o.value).filter((v) => selectedValues.has(v)),
    [options, selectedValues]
  );
  return (
    <FilterMultiSelect
      label={title}
      options={items}
      value={value}
      onValueChange={(next) => onSelectionChange(new Set(next))}
    />
  );
}

/**
 * AdvancedFilterBar Props
 */
interface AdvancedFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDefinition[];
  selectedFilters?: SelectedFilters;
  onFilterChange?: (filterId: string, values: Set<string>) => void;
  onClearAllFilters?: () => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Advanced filter bar component
 * Reference: shadcnuikit.com/dashboard/products
 * - Search input (left)
 * - Multiple filter dropdowns (FacetedFilter)
 * - Additional action buttons (children)
 */
export function AdvancedFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  selectedFilters = {},
  onFilterChange,
  onClearAllFilters,
  children,
  className,
}: AdvancedFilterBarProps) {
  const hasActiveFilters = Object.values(selectedFilters).some(
    (set) => set.size > 0
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative w-full sm:w-64 lg:w-80">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <FacetedFilter
            key={filter.id}
            title={filter.title}
            options={filter.options}
            selectedValues={selectedFilters[filter.id] || new Set()}
            onSelectionChange={(values) => onFilterChange?.(filter.id, values)}
          />
        ))}

        {/* Reset filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 lg:px-3"
            onClick={onClearAllFilters}
          >
            Reset
            <X className="size-4" />
          </Button>
        )}
      </div>

      {/* Right-hand action area (Columns button, etc.) */}
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * useAdvancedFilter hook - manages filter state
 */
export function useAdvancedFilter(filterIds: string[]) {
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedFilters, setSelectedFilters] = React.useState<SelectedFilters>(
    () =>
      filterIds.reduce((acc, id) => ({ ...acc, [id]: new Set<string>() }), {})
  );

  const handleFilterChange = React.useCallback(
    (filterId: string, values: Set<string>) => {
      setSelectedFilters((prev) => ({
        ...prev,
        [filterId]: values,
      }));
    },
    []
  );

  const clearAllFilters = React.useCallback(() => {
    setSelectedFilters(
      filterIds.reduce((acc, id) => ({ ...acc, [id]: new Set<string>() }), {})
    );
  }, [filterIds]);

  const hasActiveFilters = React.useMemo(
    () => Object.values(selectedFilters).some((set) => set.size > 0),
    [selectedFilters]
  );

  return {
    searchValue,
    setSearchValue,
    selectedFilters,
    handleFilterChange,
    clearAllFilters,
    hasActiveFilters,
  };
}
