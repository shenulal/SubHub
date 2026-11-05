// src/app/(dashboard)/reports/cost/page.tsx
import {
  detectCostAnomalies,
  getCostStatistics,
  getMonthlyCostTrend,
  getTopCostApps,
} from "@/actions/cost-analytics";
import { getTeams } from "@/actions/teams";
import { getUsers } from "@/actions/users-read";
import {
  MonthlyTrendChart,
  SeatAnalysisSection,
} from "@/components/reports/cost";
import { ReportStatCard } from "@/components/reports/report-stat-card";
import { TeamUserFilterRouter } from "@/components/reports/team-user-filter-router";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import {
  AlertTriangle,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarClock,
  DollarSign,
  Receipt,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ExportButtons } from "./_components/export-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.cost.page");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

// headers 사용으로 정적 프리렌더 불가, 동적 렌더링 강제
// NextAuth 세션 조회 + 실시간 비용 데이터(fetch + headers 사용)로 인해 정적 프리렌더 불가
export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency, "ko", 0);
}

function formatPercentage(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
    userId?: string;
  }>;
}

export default async function CostAnalysisPage({ searchParams }: PageProps) {
  const t = await getTranslations("reports.cost");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const baseCurrency = session.user.organizationId
    ? await getBaseCurrency(session.user.organizationId)
    : DEFAULT_BASE_CURRENCY;
  const params = await searchParams;
  const isRestricted = session.user.role !== "ADMIN";
  const requestedTeamId = params.teamId ?? null;
  const requestedUserId = params.userId ?? null;
  const effectiveTeamId = isRestricted
    ? (session.user.teamId ?? null)
    : requestedTeamId;
  const effectiveUserId =
    isRestricted && !session.user.teamId ? session.user.id : requestedUserId;

  // 데이터 조회
  const [statisticsResult, trendResult, topAppsResult, anomaliesResult] =
    await Promise.all([
      getCostStatistics({
        teamId: effectiveTeamId ?? undefined,
        userId: effectiveUserId ?? undefined,
      }),
      getMonthlyCostTrend({
        months: 6,
        teamId: effectiveTeamId ?? undefined,
        userId: effectiveUserId ?? undefined,
      }),
      getTopCostApps({
        limit: 5,
        teamId: effectiveTeamId ?? undefined,
        userId: effectiveUserId ?? undefined,
      }),
      detectCostAnomalies({
        teamId: effectiveTeamId ?? undefined,
        userId: effectiveUserId ?? undefined,
      }),
    ]);

  const [teamsResult, usersResult] = await Promise.all([
    getTeams(),
    getUsers({ limit: 1000 }),
  ]);

  const teamOptions = teamsResult.success
    ? (teamsResult.data ?? []).map((team) => ({ id: team.id, name: team.name }))
    : [];
  const userOptions = usersResult.items.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.team?.id ?? null,
    teamName: user.team?.name ?? null,
  }));

  const filteredTeams = isRestricted
    ? teamOptions.filter((team) => team.id === session.user.teamId)
    : teamOptions;
  const filteredUsers = isRestricted
    ? session.user.teamId
      ? userOptions.filter((user) => user.teamId === session.user.teamId)
      : userOptions.filter((user) => user.id === session.user.id)
    : userOptions;

  const statistics = statisticsResult.success
    ? (statisticsResult.data?.statistics ?? null)
    : null;
  const trends = trendResult.success ? trendResult.data?.trends : [];
  const topApps = topAppsResult.success ? topAppsResult.data?.apps : [];
  const anomalies = anomaliesResult.success
    ? anomaliesResult.data?.anomalies
    : [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-medium">{t("page.title")}</h1>
        </div>
        {session.user.role !== "VIEWER" && (
          <ExportButtons
            statistics={statistics}
            trends={trends || []}
            topApps={topApps || []}
            anomalies={anomalies || []}
            filters={{ teamId: effectiveTeamId, userId: effectiveUserId }}
          />
        )}
      </div>

      {/* 핵심 지표 */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard
          icon={Wallet}
          tone="primary"
          title={t("stats.totalCost")}
          value={
            statistics
              ? formatCurrency(
                  statistics.totalCost,
                  statistics.currency || baseCurrency
                )
              : "-"
          }
          caption={
            statistics && statistics.costChange !== 0 ? (
              <p
                className={`truncate ${
                  statistics.costChange > 0 ? "text-error" : "text-success"
                }`}
              >
                {statistics.costChange > 0 ? (
                  <ArrowUpIcon className="mr-1 inline h-3 w-3" />
                ) : (
                  <ArrowDownIcon className="mr-1 inline h-3 w-3" />
                )}
                {t("stats.vsLastMonth", {
                  value: formatPercentage(statistics.costChange),
                })}
              </p>
            ) : undefined
          }
        />

        <ReportStatCard
          icon={CalendarClock}
          tone="info"
          title={t("stats.monthlyAverage")}
          value={
            statistics
              ? formatCurrency(
                  statistics.monthlyAverage,
                  statistics.currency || baseCurrency
                )
              : "-"
          }
          caption={t("stats.last30Days")}
        />

        <ReportStatCard
          icon={Receipt}
          tone="success"
          title={t("stats.transactionCount")}
          value={
            statistics ? statistics.transactionCount.toLocaleString() : "-"
          }
          caption={t("stats.thisPeriod")}
        />

        <ReportStatCard
          icon={AlertTriangle}
          tone="warning"
          title={t("stats.anomalyDetection")}
          value={t("stats.anomalyCount", { count: anomalies?.length || 0 })}
          caption={t("stats.anomalyThreshold")}
        />
      </div>

      <TeamUserFilterRouter
        basePath="/reports/cost"
        teamId={effectiveTeamId}
        userId={effectiveUserId}
        teams={filteredTeams}
        users={filteredUsers}
        includeAllOption={!isRestricted}
        teamLocked={isRestricted}
      />

      {/* 월별 추세 */}
      <MonthlyTrendChart
        initialData={trends || []}
        teamId={effectiveTeamId}
        userId={effectiveUserId}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 앱별 비용 분포 */}
        <Card className="xl:min-h-[450px]">
          <CardHeader>
            <CardTitle>{t("distribution.title")}</CardTitle>
            <CardDescription>{t("distribution.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topApps && topApps.length > 0 ? (
              <div className="space-y-4">
                {topApps.map((app) => (
                  <div
                    key={app.appId}
                    className="flex min-w-0 items-center justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                        <DollarSign className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={app.appName}>
                          {app.appName}
                        </p>
                        <p className="text-muted-foreground truncate text-[0.8125rem]">
                          {t("distribution.percentage", {
                            value: app.percentage.toFixed(1),
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatCurrency(app.totalCost, baseCurrency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="tonal-neutral flex size-10 items-center justify-center rounded-md">
                  <DollarSign className="size-5" />
                </div>
                <p className="text-muted-foreground text-[0.9375rem]">
                  {t("distribution.noData")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 비용 이상 감지 */}
        <Card className="xl:min-h-[450px]">
          <CardHeader>
            <CardTitle className="flex min-w-0 items-center gap-2">
              <span className="truncate">{t("anomaly.title")}</span>
              {anomalies && anomalies.length > 0 && (
                <Badge variant="error">
                  {t("anomaly.count", { count: anomalies.length })}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{t("anomaly.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {anomalies && anomalies.length > 0 ? (
              <div className="space-y-3">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.appId}
                    className="hover:bg-muted flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate font-medium"
                        title={anomaly.appName}
                      >
                        {anomaly.appName}
                      </p>
                      <p className="text-muted-foreground truncate text-[0.8125rem] tabular-nums">
                        {formatCurrency(anomaly.previousCost, baseCurrency)} →{" "}
                        {formatCurrency(anomaly.currentCost, baseCurrency)}
                      </p>
                    </div>
                    <Badge
                      variant={
                        anomaly.severity === "high"
                          ? "error"
                          : anomaly.severity === "medium"
                            ? "warning"
                            : "info"
                      }
                    >
                      +{anomaly.changeRate}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="tonal-success flex size-10 items-center justify-center rounded-md">
                  <AlertTriangle className="size-5" />
                </div>
                <p className="text-muted-foreground text-[0.9375rem]">
                  {t("anomaly.noAnomalies")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seat 분석 섹션 (D-2 + D-4) */}
      <SeatAnalysisSection />
    </div>
  );
}
