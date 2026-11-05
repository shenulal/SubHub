"use client";

// src/app/(dashboard)/reports/block-events/page.client.tsx
import type { BlockEventItem } from "@/actions/reports/block-events";
import { DateRangeSelector } from "@/components/common/date-range-selector";
import { ReportStatCard } from "@/components/reports/report-stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Globe, Search, ShieldBan } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

interface BlockEventsPageClientProps {
  initialData: BlockEventItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  statsSummary: {
    totalBlocks: number;
    uniqueDomains: number;
    topBlockedDomains: Array<{ domain: string; count: number }>;
  };
  initialFilters: {
    startDate: string;
    endDate: string;
    search: string;
    period: string;
  };
  presets: Array<{
    value: string;
    label: string;
  }>;
}

export function BlockEventsPageClient({
  initialData,
  pagination,
  statsSummary,
  initialFilters,
  presets,
}: BlockEventsPageClientProps) {
  const router = useRouter();
  const t = useTranslations("reports.blockEvents");
  const locale = useLocale();

  const [period] = useState(initialFilters.period);
  const [search, setSearch] = useState(initialFilters.search);

  // Update URL params
  const updateUrlParams = useCallback(
    (params: {
      period?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
    }) => {
      const urlParams = new URLSearchParams();

      const newPeriod = params.period ?? period;
      const newStartDate = params.startDate ?? initialFilters.startDate;
      const newEndDate = params.endDate ?? initialFilters.endDate;
      const newSearch = params.search ?? search;
      const newPage = params.page ?? pagination.page;

      if (newPeriod && newPeriod !== "custom") {
        urlParams.set("period", newPeriod);
      } else if (newStartDate && newEndDate) {
        urlParams.set("period", "custom");
        urlParams.set("startDate", newStartDate);
        urlParams.set("endDate", newEndDate);
      }

      if (newSearch) urlParams.set("search", newSearch);
      if (newPage > 1) urlParams.set("page", newPage.toString());

      const queryString = urlParams.toString();
      router.push(
        queryString
          ? `/reports/block-events?${queryString}`
          : "/reports/block-events"
      );
    },
    [
      router,
      period,
      initialFilters.startDate,
      initialFilters.endDate,
      search,
      pagination.page,
    ]
  );

  // Handle search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateUrlParams({ search, page: 1 });
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    updateUrlParams({ page });
  };

  // Format date for display
  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("filters.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <DateRangeSelector
            currentPeriod={initialFilters.period}
            startDate={initialFilters.startDate}
            endDate={initialFilters.endDate}
            presets={presets}
            basePath="/reports/block-events"
            preserveParams={{ search: search }}
          />
          <Button variant="outline" className="h-10 shrink-0">
            <Download className="mr-2 h-4 w-4" />
            {t("filters.export")}
          </Button>
        </div>
      </div>

      {/* Stats Summary - Bento Style */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ReportStatCard
          icon={ShieldBan}
          tone="error"
          title={t("stats.totalBlocks")}
          value={statsSummary.totalBlocks.toLocaleString()}
        />
        <ReportStatCard
          icon={Globe}
          tone="warning"
          title={t("stats.blockedDomains")}
          value={statsSummary.uniqueDomains.toLocaleString()}
        />
      </div>

      {/* Top Blocked Domains */}
      {statsSummary.topBlockedDomains.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("topDomains.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {statsSummary.topBlockedDomains.map((item) => (
                <div
                  key={item.domain}
                  className="tonal-error flex max-w-full min-w-0 items-center gap-2 rounded-md px-3 py-1 text-sm"
                >
                  <span className="truncate font-medium" title={item.domain}>
                    {item.domain}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {t("topDomains.countSuffix", { count: item.count })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.url")}</TableHead>
                <TableHead>{t("table.blockReason")}</TableHead>
                <TableHead>{t("table.user")}</TableHead>
                <TableHead>{t("table.blockedAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <p className="text-muted-foreground">{t("table.empty")}</p>
                  </TableCell>
                </TableRow>
              ) : (
                initialData.map((item) => (
                  <TableRow
                    key={item.id}
                    className="hover:bg-muted/60 transition-colors"
                  >
                    <TableCell className="max-w-sm truncate">
                      <span title={item.url}>{item.url}</span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <span title={item.blockReason}>{item.blockReason}</span>
                    </TableCell>
                    <TableCell>
                      {item.userName ? (
                        <div className="min-w-0">
                          <div className="max-w-[16rem] truncate text-sm font-medium">
                            {item.userName}
                          </div>
                          {item.userEmail && (
                            <div className="text-muted-foreground max-w-[16rem] truncate text-xs">
                              {item.userEmail}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(item.blockedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
            <div className="text-muted-foreground text-[0.8125rem]">
              {t("table.totalRecords", { total: pagination.total })}
            </div>
            {pagination.totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        pagination.page > 1 &&
                        handlePageChange(pagination.page - 1)
                      }
                      className={
                        pagination.page <= 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      const pageNum = Math.max(1, pagination.page - 2) + i;
                      if (pageNum > pagination.totalPages) return null;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => handlePageChange(pageNum)}
                            isActive={pageNum === pagination.page}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    }
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        pagination.page < pagination.totalPages &&
                        handlePageChange(pagination.page + 1)
                      }
                      className={
                        pagination.page >= pagination.totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
