"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Check, PlusCircle, Search, X } from "lucide-react";
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
 * FacetedFilter component - multi-select filter dropdown
 */
function FacetedFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
}: FacetedFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 border-dashed"
        >
          <PlusCircle className="size-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const newSet = new Set(selectedValues);
                      if (isSelected) {
                        newSet.delete(option.value);
                      } else {
                        newSet.add(option.value);
                      }
                      onSelectionChange(newSet);
                    }}
                  >
                    <div
                      className={cn(
                        "border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    {option.icon && (
                      <option.icon className="text-muted-foreground mr-2 h-4 w-4" />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onSelectionChange(new Set())}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
