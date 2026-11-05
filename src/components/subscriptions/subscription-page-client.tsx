// src/components/subscriptions/subscription-page-client.tsx
"use client";

/**
 * Subscription list page shell (9.2 / 9.3 / 9.6 / 4.5). All filter, sort and
 * pagination state lives in the URL; this component reads it, renders the
 * filter bar, saved views, summary, table and bulk bar, and writes changes back.
 */
import { exportSubscriptionsCsv } from "@/actions/discovery/export";
import { getMatchingSubscriptionIds } from "@/actions/discovery/list";
import { Can } from "@/components/common/can";
import { ColumnsDropdown } from "@/components/common/columns-dropdown";
import { useDataTable } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import {
  countActiveFilters,
  parseListQuery,
  serializeListQuery,
} from "@/lib/services/discovery/filter-params";
import { formatMoney } from "@/lib/services/discovery/money";
import { downloadCSV } from "@/lib/services/export/csv";
import type {
  DiscoverySubscriptionItem,
  SavedViewDto,
  SubscriptionFilterOptions,
  SubscriptionListFilter,
  SubscriptionListQuery,
  SubscriptionListSort,
} from "@/types/discovery";
import { AlertTriangle, Download, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { SavedViewsBar } from "./saved-views-bar";
import { SubscriptionBulkBar } from "./subscription-bulk-bar";
import { SubscriptionFilters } from "./subscription-filters";
import { SubscriptionList } from "./subscription-list";

export interface SubscriptionPageClientProps {
  items: DiscoverySubscriptionItem[];
  total: number;
  totalPages: number;
  monthlyTotalBase: number;
  baseCurrency: string;
  hasStaleRates: boolean;
  pageSizeOptions: number[];
  defaultPageSize: number;
  options: SubscriptionFilterOptions;
  savedViews: SavedViewDto[];
  canSelect: boolean;
  error?: string;
}

const COLUMN_IDS = [
  "app",
  "tags",
  "owner",
  "cost",
  "cycle",
  "status",
  "renewal",
];

export function SubscriptionPageClient({
  items,
  total,
  monthlyTotalBase,
  baseCurrency,
  hasStaleRates,
  pageSizeOptions,
  defaultPageSize,
  options,
  savedViews,
  canSelect,
  error,
}: SubscriptionPageClientProps) {
  const t = useTranslations("discovery.list");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isExporting, startExport] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const { columnVisibility, handleColumnVisibilityChange } = useDataTable({
    defaultPageSize,
  });

  const query = useMemo<SubscriptionListQuery>(
    () => parseListQuery(searchParams, defaultPageSize),
    [searchParams, defaultPageSize]
  );

  const navigate = useCallback(
    (next: Partial<SubscriptionListQuery>) => {
      const merged: SubscriptionListQuery = {
        filter: next.filter ?? query.filter,
        sort: next.sort ?? query.sort,
        page: next.page ?? 1,
        limit: next.limit ?? query.limit,
      };
      const params = serializeListQuery(merged, defaultPageSize).toString();
      setSelectedIds(new Set());
      setAllMatching(false);
      router.push(params ? `${pathname}?${params}` : pathname);
    },
    [query, router, pathname, defaultPageSize]
  );

  const patchFilter = useCallback(
    (patch: Partial<SubscriptionListFilter>) =>
      navigate({ filter: { ...query.filter, ...patch } }),
    [navigate, query.filter]
  );
  const setSort = useCallback(
    (sort: SubscriptionListSort) => navigate({ sort, page: query.page }),
    [navigate, query.page]
  );
  const resetFilters = useCallback(
    () => navigate({ filter: { scope: query.filter.scope } }),
    [navigate, query.filter.scope]
  );
  const applyView = useCallback(
    (view: SavedViewDto) =>
      navigate({ filter: view.filters, sort: view.sort ?? undefined }),
    [navigate]
  );

  const selectAllMatching = useCallback(async () => {
    const result = await getMatchingSubscriptionIds(query.filter);
    if (!result.success || !result.data) {
      toast.error(result.error ?? t("selectAllFailed"));
      return;
    }
    setSelectedIds(new Set(result.data.ids));
    setAllMatching(true);
    if (result.data.capped) toast.warning(t("selectionCapped"));
  }, [query.filter, t]);

  const exportView = () => {
    startExport(async () => {
      const result = await exportSubscriptionsCsv({
        filter: query.filter,
        sort: query.sort,
      });
      if (result.success && result.data) {
        downloadCSV(result.data.csv, result.data.filename);
        toast.success(t("exported", { count: result.data.rowCount }));
      } else {
        toast.error(result.error ?? t("exportFailed"));
      }
    });
  };

  const activeFilters = countActiveFilters(query.filter);

  return (
    <div className="space-y-6" data-testid="subscription-page">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="text-foreground text-2xl font-medium">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem]">
            <span className="tabular-nums">
              {t("summary", {
                count: total,
                total: formatMoney(monthlyTotalBase, baseCurrency, locale),
              })}
            </span>
            {hasStaleRates && (
              <span className="tonal-warning inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.8125rem] font-medium whitespace-nowrap">
                <AlertTriangle className="size-3.5" />
                {t("staleRates")}
              </span>
            )}
          </p>
        </div>
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 [&_button]:whitespace-nowrap [&>button]:h-[38px] [&>button]:px-4 [&>button]:text-[0.9375rem]">
          <ColumnsDropdown
            columns={COLUMN_IDS.map((id) => ({
              id,
              header: t(`columns.${id}`),
            }))}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />
          <Can permission="subscriptions:export">
            <Button
              variant="outline"
              className="shrink-0"
              onClick={exportView}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {t("export")}
            </Button>
          </Can>
          <Can permission="subscriptions:create">
            <Button className="shrink-0 whitespace-nowrap" asChild>
              <Link href="/subscriptions/new">
                <Plus className="size-4" />
                {t("add")}
              </Link>
            </Button>
          </Can>
        </div>
      </div>

      <div className="border-border flex min-w-0 flex-col gap-4 rounded-md border p-4">
        <SavedViewsBar
          views={savedViews}
          filter={query.filter}
          sort={query.sort}
          onApply={applyView}
        />
        <div className="border-border border-t" aria-hidden />
        <SubscriptionFilters
          filter={query.filter}
          sort={query.sort}
          options={options}
          onFilterChange={patchFilter}
          onSortChange={setSort}
          onReset={resetFilters}
        />
      </div>

      {error && (
        <div className="tonal-error rounded-md px-4 py-3 text-[0.9375rem]">
          {error}
        </div>
      )}

      <SubscriptionList
        subscriptions={items}
        baseCurrency={baseCurrency}
        sort={query.sort}
        onSortChange={setSort}
        page={query.page}
        limit={query.limit}
        total={total}
        pageSizeOptions={pageSizeOptions}
        onPageChange={(page, limit) => navigate({ page, limit })}
        selectedIds={selectedIds}
        onSelectedIdsChange={(ids) => {
          setSelectedIds(ids);
          setAllMatching(false);
        }}
        canSelect={canSelect}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        hasFilters={activeFilters > 0}
        onResetFilters={resetFilters}
      />

      <SubscriptionBulkBar
        selectedIds={Array.from(selectedIds)}
        matchingTotal={total}
        pageRowCount={items.length}
        allMatchingSelected={allMatching}
        onSelectAllMatching={selectAllMatching}
        onClear={() => {
          setSelectedIds(new Set());
          setAllMatching(false);
        }}
        options={options}
        filter={query.filter}
      />
    </div>
  );
}
