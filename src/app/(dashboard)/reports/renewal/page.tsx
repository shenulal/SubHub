// src/app/(dashboard)/reports/renewal/page.tsx
import { getRenewalReportData } from "@/actions/dashboard";
import { getTeams } from "@/actions/teams";
import { getUsers } from "@/actions/users-read";
import { RenewalCalendarSection } from "@/components/reports/renewal";
import { ReportStatCard } from "@/components/reports/report-stat-card";
import { TeamUserFilterRouter } from "@/components/reports/team-user-filter-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import { AlarmClock, CalendarClock, CalendarSync, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ExportButtons } from "./_components/export-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports.renewal.page");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

function formatCurrency(
  amount: number,
  currency: string,
  locale: string = "ko"
): string {
  return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date, locale: string = "ko"): string {
  return new Date(date).toLocaleDateString(
    locale === "ko" ? "ko-KR" : "en-US",
    {
      month: "2-digit",
      day: "2-digit",
    }
  );
}

interface PageProps {
  searchParams: Promise<{
    teamId?: string;
    userId?: string;
  }>;
}

export default async function RenewalReportPage({ searchParams }: PageProps) {
  const t = await getTranslations("reports.renewal");
  const locale = await getLocale();
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

  const [data, teamsResult, usersResult] = await Promise.all([
    getRenewalReportData({
      teamId: effectiveTeamId ?? undefined,
      userId: effectiveUserId ?? undefined,
    }),
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

  const renderRenewalList = (
    title: string,
    items: typeof data.within7Days,
    emptyMessage: string
  ) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-[0.9375rem]">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="hover:bg-muted flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium" title={item.appName}>
                    {item.appName}
                  </p>
                  <p className="text-muted-foreground truncate text-[0.8125rem]">
                    {formatDate(item.renewalDate, locale)} ·{" "}
                    {t("daysLeft", { days: item.daysUntilRenewal })}
                  </p>
                </div>
                <div className="shrink-0 text-[0.9375rem] font-medium tabular-nums">
                  {formatCurrency(item.amount, item.currency, locale)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-medium">{t("page.title")}</h1>
        </div>
        {session.user.role !== "VIEWER" && (
          <ExportButtons
            data={data}
            filters={{ teamId: effectiveTeamId, userId: effectiveUserId }}
          />
        )}
      </div>

      {/* 핵심 지표 - Bento 스타일 KPI 카드 */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <ReportStatCard
          icon={CalendarSync}
          tone="primary"
          title={t("stats.totalCount")}
          value={t("count", { count: data.totalCount })}
        />
        <ReportStatCard
          icon={Wallet}
          tone="info"
          title={t("stats.totalCost")}
          value={formatCurrency(data.totalRenewalCost, baseCurrency, locale)}
        />
        <ReportStatCard
          icon={AlarmClock}
          tone="error"
          title={t("stats.within7Days")}
          value={t("count", { count: data.within7Days.length })}
        />
        <ReportStatCard
          icon={CalendarClock}
          tone="warning"
          title={t("stats.within30Days")}
          value={t("count", {
            count: data.within7Days.length + data.within30Days.length,
          })}
        />
      </div>

      <TeamUserFilterRouter
        basePath="/reports/renewal"
        teamId={effectiveTeamId}
        userId={effectiveUserId}
        teams={filteredTeams}
        users={filteredUsers}
        includeAllOption={!isRestricted}
        teamLocked={isRestricted}
      />

      {/* 캘린더 기반 갱신 일정 */}
      <RenewalCalendarSection
        renewals={[...data.within7Days, ...data.within30Days]}
      />

      {/* 기간별 갱신 리스트 */}
      <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3 xl:[&>*:last-child]:col-span-2 2xl:[&>*:last-child]:col-span-1">
        {renderRenewalList(
          t("sections.within7Days"),
          data.within7Days,
          t("sections.empty.within7Days")
        )}
        {renderRenewalList(
          t("sections.within30Days"),
          data.within30Days,
          t("sections.empty.within30Days")
        )}
        {renderRenewalList(
          t("sections.within90Days"),
          data.within90Days,
          t("sections.empty.within90Days")
        )}
      </div>
    </div>
  );
}
