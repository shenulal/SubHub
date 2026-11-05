// src/components/extensions/usage-analytics-client.tsx
"use client";

import { getDomainLoginEvents, getUsageAnalytics } from "@/actions/extensions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  DomainDetailData,
  DomainLoginItem,
  UsageAnalyticsData,
  UsageAnalyticsPeriod,
} from "@/types/extension";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  LogIn,
  Monitor,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

function getAuthTypeBadgeVariant(
  authType: string
): "default" | "secondary" | "outline" {
  switch (authType) {
    case "OAUTH":
    case "SSO":
      return "default";
    case "MAGIC_LINK":
      return "secondary";
    default:
      return "outline";
  }
}

export function UsageAnalyticsClient() {
  const t = useTranslations("extensions.usage");
  const locale = useLocale();

  const [period, setPeriod] = useState<UsageAnalyticsPeriod>("today");
  const [data, setData] = useState<UsageAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 상세 다이얼로그 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainLoginItem | null>(
    null
  );
  const [domainDetail, setDomainDetail] = useState<DomainDetailData | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const formatTime = useCallback(
    (dateString: Date | string): string => {
      const date =
        typeof dateString === "string" ? new Date(dateString) : dateString;
      return date.toLocaleTimeString(locale === "en" ? "en-US" : "ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },
    [locale]
  );

  const formatDate = useCallback(
    (dateString: string): string => {
      return new Date(dateString).toLocaleDateString(
        locale === "en" ? "en-US" : "ko-KR",
        {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        }
      );
    },
    [locale]
  );

  // 데이터 로드
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const result = await getUsageAnalytics(period);
      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        setError(result.error || t("error.loadFailed"));
      }
      setLoading(false);
    }
    fetchData();
  }, [period, t]);

  // 도메인 상세 로드
  const fetchDomainDetail = useCallback(
    async (domain: string, date: string) => {
      setDetailLoading(true);
      const result = await getDomainLoginEvents(domain, date);
      if (result.success && result.data) {
        setDomainDetail(result.data);
      } else {
        setDomainDetail(null);
      }
      setDetailLoading(false);
    },
    []
  );

  // 도메인 클릭 핸들러
  const handleDomainClick = (item: DomainLoginItem) => {
    setSelectedDomain(item);
    setDetailDialogOpen(true);
    fetchDomainDetail(item.domain, selectedDate);
  };

  // 날짜 변경 핸들러
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (selectedDomain) {
      fetchDomainDetail(selectedDomain.domain, newDate);
    }
  };

  // 날짜 이동
  const navigateDate = (direction: "prev" | "next") => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === "next" ? 1 : -1));
    const newDate = current.toISOString().split("T")[0];
    handleDateChange(newDate);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-border dark:border-border border shadow-none">
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Period Tabs */}
      <Tabs
        value={period}
        onValueChange={(v) => setPeriod(v as UsageAnalyticsPeriod)}
      >
        <TabsList>
          <TabsTrigger value="today">{t("period.today")}</TabsTrigger>
          <TabsTrigger value="week">{t("period.week")}</TabsTrigger>
          <TabsTrigger value="month">{t("period.month")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Card className="border-border dark:border-border gap-0 border px-5 shadow-none">
          <div className="flex min-w-0 items-center gap-4">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <LogIn className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-muted-foreground truncate text-[0.8125rem] font-normal">
                {t("cards.totalLogins")}
              </CardTitle>
              <div className="kpi-value text-foreground">
                {data.totalLogins.toLocaleString()}
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border dark:border-border gap-0 border px-5 shadow-none">
          <div className="flex min-w-0 items-center gap-4">
            <span className="tonal-info flex size-10 shrink-0 items-center justify-center rounded-md">
              <Monitor className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-muted-foreground truncate text-[0.8125rem] font-normal">
                {t("cards.uniqueDevices")}
              </CardTitle>
              <div className="kpi-value text-foreground">
                {data.uniqueDevices.toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Domain Table */}
      <Card className="border-border dark:border-border border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="text-primary size-5" />
            {t("domain.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topDomains.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="tonal-neutral flex size-12 items-center justify-center rounded-md">
                <Globe className="size-[22px]" />
              </span>
              <p className="text-muted-foreground text-[0.9375rem]">
                {t("domain.emptyState")}
              </p>
              <p className="text-muted-foreground text-[0.8125rem]">
                {t("domain.emptyDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.domain")}</TableHead>
                  <TableHead className="text-right">
                    {t("table.loginCount")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("table.deviceCount")}
                  </TableHead>
                  <TableHead className="w-[80px]">
                    {t("table.detail")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topDomains.map((item) => (
                  <TableRow key={item.domain}>
                    <TableCell className="font-medium">
                      <div className="flex max-w-[360px] min-w-0 items-center gap-2">
                        <Globe className="text-muted-foreground size-4 shrink-0" />
                        <span className="truncate" title={item.domain}>
                          {item.domain}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.loginCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.uniqueDevices.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDomainClick(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Domain Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {selectedDomain?.domain}
            </DialogTitle>
            <DialogDescription>
              {selectedDomain &&
                t("dialog.summary", {
                  loginCount: selectedDomain.loginCount.toLocaleString(),
                  userCount: selectedDomain.uniqueUsers,
                })}
            </DialogDescription>
          </DialogHeader>

          {/* Date Navigation */}
          <div className="bg-muted flex items-center justify-between gap-4 rounded-md p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate("prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Calendar className="text-primary h-5 w-5" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateDate("next")}
              disabled={selectedDate >= new Date().toISOString().split("T")[0]}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Login Events Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">{t("table.time")}</TableHead>
                  <TableHead>{t("table.username")}</TableHead>
                  <TableHead>{t("table.deviceId")}</TableHead>
                  <TableHead className="w-[100px]">
                    {t("table.authType")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-5 w-14 rounded-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : !domainDetail || domainDetail.events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center">
                      <Clock className="text-muted-foreground mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p className="text-muted-foreground">
                        {t("dialog.noRecords")}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {t("dialog.noRecordsHint")}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  domainDetail.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="text-muted-foreground h-3 w-3" />
                          <span className="font-mono">
                            {formatTime(event.capturedAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Users className="text-muted-foreground h-4 w-4" />
                          <div>
                            <span className="break-all">
                              {event.userName || event.username}
                            </span>
                            {event.userName && event.userEmail && (
                              <div className="text-muted-foreground text-xs">
                                {event.userEmail}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="text-muted-foreground h-4 w-4" />
                          <span className="max-w-[150px] truncate font-mono text-xs">
                            {event.deviceId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getAuthTypeBadgeVariant(event.authType)}
                        >
                          {event.authType}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results count */}
          {domainDetail && domainDetail.events.length > 0 && (
            <div className="text-muted-foreground text-sm">
              {t("dialog.resultCount", {
                date: formatDate(selectedDate),
                count: domainDetail.events.length,
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
