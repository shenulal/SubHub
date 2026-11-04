// src/components/subscriptions/subscription-list.tsx
"use client";

/**
 * Subscription table (9.2 / 9.3 / 9.6). Server-driven: sorting and pagination
 * emit changes that the page writes to the URL; rows are rendered as given.
 */
import { DataTable, type SortState } from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import type {
  DiscoverySubscriptionItem,
  SubscriptionListSort,
  SubscriptionSortField,
} from "@/types/discovery";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useMemo } from "react";

import {
  buildSubscriptionColumns,
  type ColumnLabels,
} from "./subscription-list-columns";
import { SubscriptionRowActions } from "./subscription-row-actions";

const COLUMN_TO_SORT: Record<string, SubscriptionSortField> = {
  app: "appName",
  owner: "owner",
  cost: "amount",
  status: "status",
  renewal: "renewalDate",
};
const SORT_TO_COLUMN: Partial<Record<SubscriptionSortField, string>> = {
  appName: "app",
  owner: "owner",
  amount: "cost",
  status: "status",
  renewalDate: "renewal",
};

export interface SubscriptionListProps {
  subscriptions: DiscoverySubscriptionItem[];
  baseCurrency: string;
  sort: SubscriptionListSort;
  onSortChange: (sort: SubscriptionListSort) => void;
  page: number;
  limit: number;
  total: number;
  pageSizeOptions: number[];
  onPageChange: (page: number, limit: number) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  canSelect: boolean;
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  hasFilters: boolean;
  onResetFilters: () => void;
  now?: Date;
}

export function SubscriptionList({
  subscriptions,
  baseCurrency,
  sort,
  onSortChange,
  page,
  limit,
  total,
  pageSizeOptions,
  onPageChange,
  selectedIds,
  onSelectedIdsChange,
  canSelect,
  columnVisibility,
  onColumnVisibilityChange,
  hasFilters,
  onResetFilters,
  now = new Date(),
}: SubscriptionListProps) {
  const t = useTranslations("discovery.list");
  const ts = useTranslations("subscriptions.status");
  const tc = useTranslations("subscriptions.billingCycle");
  const locale = useLocale();

  const labels = useMemo<ColumnLabels>(
    () => ({
      app: t("columns.app"),
      tags: t("columns.tags"),
      owner: t("columns.owner"),
      cost: t("columns.cost"),
      cycle: t("columns.cycle"),
      status: t("columns.status"),
      renewal: t("columns.renewal"),
      monthly: t("perMonth"),
      statusLabel: (status: SubscriptionStatus) => ts(status.toLowerCase()),
      cycleLabel: (cycle: BillingCycle) => {
        const key: Record<BillingCycle, string> = {
          MONTHLY: "monthly",
          QUARTERLY: "quarterly",
          YEARLY: "yearly",
          ONE_TIME: "oneTime",
        };
        return tc(key[cycle]);
      },
      renewal_labels: {
        overdue: (days: number) => t("overdue", { days }),
        inDays: (days: number) => t("inDays", { days }),
        today: t("today"),
        trial: t("trial"),
        notice: t("notice"),
      },
    }),
    [t, ts, tc]
  );

  const columns = useMemo(
    () =>
      buildSubscriptionColumns({
        labels,
        baseCurrency,
        locale,
        now,
        renderActions: (item) => <SubscriptionRowActions subscription={item} />,
      }),
    [labels, baseCurrency, locale, now]
  );

  const sortState = useMemo<SortState | null>(() => {
    const columnId = SORT_TO_COLUMN[sort.sortBy];
    return columnId ? { columnId, direction: sort.sortOrder } : null;
  }, [sort]);

  const handleSortChange = useCallback(
    (next: SortState | null) => {
      if (!next || !next.direction) {
        onSortChange({ sortBy: "renewalDate", sortOrder: "asc" });
        return;
      }
      const field = COLUMN_TO_SORT[next.columnId];
      if (field) onSortChange({ sortBy: field, sortOrder: next.direction });
    },
    [onSortChange]
  );

  if (subscriptions.length === 0) {
    return (
      <div
        className="border-border/60 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center"
        data-testid="subscription-list-empty"
      >
        <p className="text-foreground font-medium">
          {hasFilters ? t("emptyFiltered") : t("empty")}
        </p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {hasFilters ? t("emptyFilteredHint") : t("emptyHint")}
        </p>
        <div className="mt-4 flex gap-2">
          {hasFilters && (
            <Button variant="outline" onClick={onResetFilters}>
              {t("clearFilters")}
            </Button>
          )}
          <Button asChild>
            <Link href="/subscriptions/new">{t("emptyAction")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DataTable<DiscoverySubscriptionItem>
      data={subscriptions}
      columns={columns}
      getRowId={(row) => row.id}
      enableRowSelection={canSelect}
      selectedRows={selectedIds}
      onSelectedRowsChange={onSelectedIdsChange}
      enableColumnVisibility
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      enableSorting
      sortState={sortState}
      onSortChange={handleSortChange}
      enablePagination
      pagination={{ pageIndex: page - 1, pageSize: limit }}
      onPaginationChange={(p) => onPageChange(p.pageIndex + 1, p.pageSize)}
      totalCount={total}
      pageSizeOptions={pageSizeOptions}
      emptyMessage={t("empty")}
      hideToolbar
    />
  );
}
