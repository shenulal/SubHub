// src/app/(dashboard)/reports/registered-app-usage/page.client.tsx
"use client";

import type {
  RegisteredAppUsageItem,
  RegisteredAppUsageResponse,
} from "@/actions/reports/registered-app-usage";
import { DateRangeSelector } from "@/components/common/date-range-selector";
import { ReportStatCard } from "@/components/reports/report-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AppWindow,
  Clock,
  Download,
  ExternalLink,
  MousePointerClick,
  Search,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface RegisteredAppUsagePageClientProps {
  initialData: RegisteredAppUsageResponse | undefined;
  initialFilters: {
    startDate: string;
    endDate: string;
    appId: string;
    userId: string;
    search: string;
    period: string;
  };
  presets: { value: string; label: string }[];
}

export function RegisteredAppUsagePageClient({
  initialData,
  initialFilters,
  presets,
}: RegisteredAppUsagePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("reports.registeredAppUsage");

  const [filters, setFilters] = useState(initialFilters);

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyFilters(overrides?: Partial<typeof filters>) {
    const f = { ...filters, ...overrides };
    const params = new URLSearchParams();
    if (f.period) params.set("period", f.period);
    if (f.period === "custom") {
      if (f.startDate) params.set("startDate", f.startDate);
      if (f.endDate) params.set("endDate", f.endDate);
    }
    if (f.appId) params.set("appId", f.appId);
    if (f.userId) params.set("userId", f.userId);
    if (f.search) params.set("search", f.search);

    router.push(`/reports/registered-app-usage?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/reports/registered-app-usage?${params.toString()}`);
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}${t("format.hours")} ${minutes}${t("format.minutes")}`;
    }
    return `${minutes}${t("format.minutes")}`;
  }

  function formatDateTime(date: Date): string {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const data = initialData;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Filter bar - row 1: search (left) + period/export (right) */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-0 sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder={t("filters.searchPlaceholder")}
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="h-10 pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <DateRangeSelector
            currentPeriod={filters.period}
            startDate={filters.startDate}
            endDate={filters.endDate}
            presets={presets}
            basePath="/reports/registered-app-usage"
            preserveParams={{
              search: filters.search,
              appId: filters.appId,
              userId: filters.userId,
            }}
          />

          <Button variant="outline" className="h-10 shrink-0">
            <Download className="mr-2 h-4 w-4" />
            {t("filters.export")}
          </Button>
        </div>
      </div>

      {/* Summary Cards - Bento Style */}
      {summary && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <ReportStatCard
            icon={MousePointerClick}
            tone="primary"
            title={t("stats.totalVisits")}
            value={summary.totalVisits.toLocaleString()}
          />
          <ReportStatCard
            icon={Users}
            tone="info"
            title={t("stats.activeUsers")}
            value={String(summary.uniqueUsers)}
          />
          <ReportStatCard
            icon={AppWindow}
            tone="success"
            title={t("stats.usedApps")}
            value={String(summary.uniqueApps)}
          />
          <ReportStatCard
            icon={Clock}
            tone="warning"
            title={t("stats.totalDuration")}
            value={formatDuration(summary.totalDuration)}
          />
        </div>
      )}

      {/* Data Table */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          {!data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
                <AppWindow className="size-5" />
              </div>
              <p className="text-muted-foreground">{t("table.empty")}</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.appName")}</TableHead>
                    <TableHead>{t("table.url")}</TableHead>
                    <TableHead>{t("table.user")}</TableHead>
                    <TableHead>{t("table.visitedAt")}</TableHead>
                    <TableHead>{t("table.duration")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item: RegisteredAppUsageItem) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-muted/60 transition-colors"
                    >
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="max-w-[14rem] truncate font-medium"
                            title={item.appName}
                          >
                            {item.appName}
                          </span>
                          {item.appId && (
                            <Link
                              href={`/apps/${item.appId}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div
                          className="max-w-[300px] truncate font-mono text-xs"
                          title={item.url}
                        >
                          {item.url}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="max-w-[16rem] truncate text-sm font-medium">
                            {item.userName || "Unknown"}
                          </span>
                          <span className="text-muted-foreground max-w-[16rem] truncate text-xs">
                            {item.userEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm whitespace-nowrap">
                          {formatDateTime(item.visitedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.durationSeconds ? (
                          <Badge variant="outline">
                            {formatDuration(item.durationSeconds)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
                  <div className="text-muted-foreground text-[0.8125rem]">
                    {t("pagination.totalItems", {
                      total: data.total.toLocaleString(),
                      start: (
                        (data.page - 1) * data.limit +
                        1
                      ).toLocaleString(),
                      end: Math.min(
                        data.page * data.limit,
                        data.total
                      ).toLocaleString(),
                    })}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.page - 1)}
                      disabled={data.page === 1}
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-sm whitespace-nowrap tabular-nums">
                      {t("pagination.pageOf", {
                        page: data.page,
                        totalPages: data.totalPages,
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.page + 1)}
                      disabled={data.page === data.totalPages}
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
