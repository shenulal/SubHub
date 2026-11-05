"use client";

import { Filter, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  id: string;
  label: string;
  placeholder?: string;
  options: FilterOption[];
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (filterId: string, value: string) => void;
  onClearFilters?: () => void;
  className?: string;
}

/**
 * Advanced filter bar component
 * - Search input
 * - Multiple filter dropdowns
 * - Active filter badges
 * - Reset filters button
 */
export function FilterBar({
  searchPlaceholder,
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
  className,
}: FilterBarProps) {
  const t = useTranslations("filterBar");
  const resolvedPlaceholder = searchPlaceholder ?? t("searchPlaceholder");
  const activeFilterCount = Object.values(filterValues).filter(
    (v) => v && v !== "all"
  ).length;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Search input */}
      <div className="relative max-w-sm min-w-[200px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder={resolvedPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter dropdowns */}
      {filters.map((filter) => (
        <Select
          key={filter.id}
          value={filterValues[filter.id] || "all"}
          onValueChange={(value) => onFilterChange?.(filter.id, value)}
        >
          <SelectTrigger className="w-auto min-w-[120px] shrink-0">
            <Filter className="text-muted-foreground size-4" />
            <SelectValue placeholder={filter.placeholder || filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("allPrefix", { label: filter.label })}
            </SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Active filters and reset */}
      {activeFilterCount > 0 && (
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="primary" className="gap-1">
            {t("activeFilters", { count: activeFilterCount })}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2"
          >
            <X className="mr-1 h-3 w-3" />
            {t("reset")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Simple search bar component
 */
interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SearchBar({
  placeholder,
  value = "",
  onChange,
  className,
}: SearchBarProps) {
  const t = useTranslations("filterBar");
  const resolvedPlaceholder = placeholder ?? t("searchPlaceholder");
  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        placeholder={resolvedPlaceholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
