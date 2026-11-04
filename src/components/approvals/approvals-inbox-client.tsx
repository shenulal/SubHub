// src/components/approvals/approvals-inbox-client.tsx
"use client";

/**
 * Feature 2.5 — approvals inbox: KPI strip, tabs, filters, sortable table and
 * CSV export (permission-gated).
 */
import { exportApprovals } from "@/actions/approvals/export";
import { getApprovalRequests } from "@/actions/approvals/requests-read";
import { getPendingApprovalsSummary } from "@/actions/approvals/summary";
import { Can } from "@/components/common/can";
import { DataTable, type SortState } from "@/components/common/data-table";
import { FilterBar } from "@/components/common/filter-bar";
import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { TabFilter } from "@/components/common/tab-filter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCSV } from "@/lib/services/export/csv";
import type {
  ApprovalInboxTab,
  ApprovalRequestListItem,
  ApprovalSortField,
} from "@/types/approval";
import { useQuery } from "@tanstack/react-query";
import { Download, Hourglass, Inbox, Plus, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useInboxColumns } from "./approvals-inbox-columns";
import { formatMoney } from "./format";

export interface InboxFilterOptions {
  categories: { id: string; name: string }[];
  requesters: { id: string; name: string | null; email: string }[];
  canReadAll: boolean;
}

const STATUSES = [
  "PENDING",
  "INFO_REQUESTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
const PAGE_SIZE = 20;

function isTab(value: string | null): value is ApprovalInboxTab {
  return value === "to_review" || value === "mine" || value === "all";
}

export function ApprovalsInboxClient({
  options,
}: {
  options: InboxFilterOptions;
}) {
  const t = useTranslations("approvals.inbox");
  const ts = useTranslations("approvals.summary");
  const tStatus = useTranslations("approvals.status");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<ApprovalInboxTab>(
    isTab(initialTab) ? initialTab : "to_review"
  );
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortState | null>({
    columnId: "submittedAt",
    direction: "desc",
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [isExporting, startExport] = useTransition();
  const columns = useInboxColumns();

  const query = useMemo(
    () => ({
      tab,
      search: search || undefined,
      status: filters.status || undefined,
      categoryId: filters.categoryId || undefined,
      requesterId: filters.requesterId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy: (sort?.columnId ?? "submittedAt") as ApprovalSortField,
      sortOrder: sort?.direction ?? "desc",
      page: pageIndex + 1,
      limit: PAGE_SIZE,
    }),
    [tab, search, filters, dateFrom, dateTo, sort, pageIndex]
  );

  const list = useQuery({
    queryKey: ["approvals", "list", query],
    queryFn: async () => {
      const res = await getApprovalRequests(query);
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
  });
  const summary = useQuery({
    queryKey: ["approvals", "summary"],
    queryFn: async () => {
      const res = await getPendingApprovalsSummary();
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
    staleTime: 30_000,
  });

  const counts = list.data?.counts;
  const tabs = useMemo(() => {
    const items: {
      value: ApprovalInboxTab;
      label: string;
      count?: number;
      variant?: "warning" | "secondary";
    }[] = [
      {
        value: "to_review",
        label: t("tabs.to_review"),
        count: counts?.toReview,
        variant: "warning",
      },
      {
        value: "mine",
        label: t("tabs.mine"),
        count: counts?.mine,
        variant: "secondary",
      },
    ];
    if (options.canReadAll) {
      items.push({
        value: "all",
        label: t("tabs.all"),
        count: counts?.all ?? undefined,
        variant: "secondary",
      });
    }
    return items;
  }, [t, counts, options.canReadAll]);

  const filterConfigs = useMemo(() => {
    const configs = [
      {
        id: "status",
        label: t("filters.status"),
        placeholder: t("filters.allStatuses"),
        options: STATUSES.map((s) => ({ value: s, label: tStatus(s) })),
      },
      {
        id: "categoryId",
        label: t("filters.category"),
        placeholder: t("filters.allCategories"),
        options: options.categories.map((c) => ({
          value: c.id,
          label: c.name,
        })),
      },
    ];
    if (options.canReadAll && options.requesters.length) {
      configs.push({
        id: "requesterId",
        label: t("filters.requester"),
        placeholder: t("filters.allRequesters"),
        options: options.requesters.map((u) => ({
          value: u.id,
          label: u.name ?? u.email,
        })),
      });
    }
    return configs;
  }, [t, tStatus, options]);

  const resetPage = useCallback(() => setPageIndex(0), []);

  const handleExport = () => {
    startExport(async () => {
      const res = await exportApprovals(query);
      if (!res.success || !res.data) {
        toast.error(res.error ?? t("exportDone", { count: 0 }));
        return;
      }
      downloadCSV(res.data.csv, res.data.filename);
      toast.success(t("exportDone", { count: res.data.rowCount }));
    });
  };

  const emptyKey = tab;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <div className="flex items-center gap-2">
          <Can permission="approvals:export">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("export")}
            </Button>
          </Can>
          <Can permission="approvals:create">
            <Button size="sm" onClick={() => router.push("/approvals/new")}>
              <Plus className="mr-2 h-4 w-4" />
              {t("newRequest")}
            </Button>
          </Can>
        </div>
      </PageHeader>

      <KpiCardsGrid>
        <KpiCard
          title={ts("count")}
          value={summary.data?.count ?? "—"}
          description={ts("description")}
          icon={Inbox}
        />
        <KpiCard
          title={ts("committed")}
          value={
            summary.data
              ? formatMoney(
                  summary.data.committedMonthly,
                  summary.data.currency
                )
              : "—"
          }
          description={ts("committedHint")}
          icon={Wallet}
        />
        <KpiCard
          title={ts("awaitingYou")}
          value={counts?.toReview ?? "—"}
          description={t("tabs.to_review")}
          icon={Hourglass}
        />
      </KpiCardsGrid>

      <div className="space-y-4">
        <TabFilter<ApprovalInboxTab>
          items={tabs}
          value={tab}
          onChange={(value) => {
            setTab(value);
            resetPage();
          }}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <FilterBar
            className="flex-1"
            searchPlaceholder={t("filters.search")}
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              resetPage();
            }}
            filters={filterConfigs}
            filterValues={filters}
            onFilterChange={(id, value) => {
              setFilters((prev) => ({ ...prev, [id]: value }));
              resetPage();
            }}
            onClearFilters={() => {
              setFilters({});
              setSearch("");
              setDateFrom("");
              setDateTo("");
              resetPage();
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label={t("filters.dateFrom")}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                resetPage();
              }}
              className="h-9 w-[150px]"
            />
            <span className="text-muted-foreground text-sm">–</span>
            <Input
              type="date"
              aria-label={t("filters.dateTo")}
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                resetPage();
              }}
              className="h-9 w-[150px]"
            />
          </div>
        </div>

        <DataTable<ApprovalRequestListItem>
          data={list.data?.items ?? []}
          columns={columns}
          getRowId={(row) => row.id}
          isLoading={list.isLoading}
          enableSorting
          sortState={sort}
          onSortChange={(s) => {
            setSort(s);
            resetPage();
          }}
          enablePagination
          pagination={{ pageIndex, pageSize: PAGE_SIZE }}
          onPaginationChange={(p) => setPageIndex(p.pageIndex)}
          totalCount={list.data?.total ?? 0}
          pageSizeOptions={[PAGE_SIZE]}
          emptyMessage={t(`empty.${emptyKey}`)}
          hideToolbar
        />
      </div>
    </div>
  );
}
