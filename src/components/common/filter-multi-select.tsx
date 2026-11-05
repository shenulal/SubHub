// src/components/common/filter-multi-select.tsx
"use client";

/**
 * MultiSelect pre-configured for list / report filters: the filter name is
 * the placeholder and accessible name, labels come from i18n, and the
 * trigger keeps a fixed width so a toolbar does not jump while picking.
 * An empty selection always means "no filter".
 */
import {
  MultiSelect,
  type MultiSelectProps,
} from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface FilterMultiSelectProps extends Omit<
  MultiSelectProps,
  | "placeholder"
  | "aria-label"
  | "searchPlaceholder"
  | "selectAllLabel"
  | "clearLabel"
  | "moreLabel"
> {
  /** Filter name, used as placeholder and accessible name. */
  label: string;
  /** Placeholder when nothing is picked (defaults to `label`). */
  placeholder?: string;
}

export function FilterMultiSelect({
  label,
  placeholder,
  className,
  emptyText,
  maxChips = 1,
  ...props
}: FilterMultiSelectProps) {
  const t = useTranslations("discovery.multiSelect");
  return (
    <MultiSelect
      {...props}
      aria-label={label}
      placeholder={placeholder ?? label}
      searchPlaceholder={t("search")}
      emptyText={emptyText ?? t("empty")}
      selectAllLabel={t("selectAll")}
      clearLabel={t("clear")}
      moreLabel={(count) => t("more", { count })}
      maxChips={maxChips}
      className={cn("w-44 shrink-0", className)}
    />
  );
}
