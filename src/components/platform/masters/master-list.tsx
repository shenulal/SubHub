"use client";

/**
 * Shared list controls for every master on the Master data hub: a search box,
 * an optional status filter and a "showing X of Y" count, plus the matching
 * filter hook and an empty-result row. Keeps all master lists consistent with
 * the vendor catalog list.
 */

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

export const MASTER_STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type MasterStatusFilter = (typeof MASTER_STATUS_FILTERS)[number];

interface MasterListOptions<T> {
  /** Text the search box matches (case-insensitive, any part). */
  searchText: (row: T) => ReadonlyArray<string | null | undefined>;
  /** Active flag for the status filter; omit to hide the filter. */
  isActive?: (row: T) => boolean;
}

export interface MasterListState<T> {
  query: string;
  setQuery: (value: string) => void;
  status: MasterStatusFilter;
  setStatus: (value: MasterStatusFilter) => void;
  visible: T[];
  total: number;
  hasStatusFilter: boolean;
}

/** Pure filter used by the hook (exported for tests). */
export function filterMasterRows<T>(
  rows: readonly T[],
  query: string,
  status: MasterStatusFilter,
  { searchText, isActive }: MasterListOptions<T>
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (isActive && status !== "all") {
      if (isActive(row) !== (status === "active")) return false;
    }
    if (!q) return true;
    return searchText(row).some((value) =>
      value ? value.toLowerCase().includes(q) : false
    );
  });
}

export function useMasterList<T>(
  rows: readonly T[],
  options: MasterListOptions<T>
): MasterListState<T> {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MasterStatusFilter>("all");
  const { searchText, isActive } = options;
  const visible = useMemo(
    () => filterMasterRows(rows, query, status, { searchText, isActive }),
    // The option callbacks are inline per render; rows/query/status drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, status]
  );
  return {
    query,
    setQuery,
    status,
    setStatus,
    visible,
    total: rows.length,
    hasStatusFilter: Boolean(isActive),
  };
}

interface MasterListToolbarProps<T> {
  list: MasterListState<T>;
  /** Search box placeholder, e.g. "Search tax rates". */
  searchPlaceholder: string;
  /** Labels for the status filter values (defaults: Active / Inactive). */
  statusLabels?: Partial<Record<MasterStatusFilter, string>>;
}

export function MasterListToolbar<T>({
  list,
  searchPlaceholder,
  statusLabels,
}: MasterListToolbarProps<T>) {
  const t = useTranslations("platform.masters.list");
  const labels: Record<MasterStatusFilter, string> = {
    all: t("allStatuses"),
    active: t("active"),
    inactive: t("inactive"),
    ...statusLabels,
  };
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {list.hasStatusFilter && (
        <Select
          value={list.status}
          onValueChange={(v) => list.setStatus(v as MasterStatusFilter)}
        >
          <SelectTrigger className="w-44" aria-label={t("statusFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MASTER_STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {labels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p
        className="text-muted-foreground ml-auto text-sm whitespace-nowrap"
        aria-live="polite"
      >
        {t("showing", { shown: list.visible.length, total: list.total })}
      </p>
    </div>
  );
}

/** Table row shown when the filters hide every record. */
export function MasterListNoMatches({ colSpan }: { colSpan: number }) {
  const t = useTranslations("platform.masters.list");
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="text-muted-foreground py-8 text-center text-sm"
      >
        {t("noMatches")}
      </TableCell>
    </TableRow>
  );
}
