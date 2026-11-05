"use client";

import {
  ResponsiveBentoGrid,
  ResponsiveBentoItem,
  TrendBadge,
} from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { useBaseCurrency } from "@/hooks/use-base-currency";
import { formatMoney } from "@/lib/fx/convert";
import type {
  AnomalyKpiData,
  AppsWithoutSubKpiData,
  TerminatedKpiData,
  TotalCostKpiData,
} from "@/types/dashboard";
import { AlertTriangle, DollarSign, PackageX, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { AnomalyCard } from "./anomaly-card";
import { AppsWithoutSubCard } from "./apps-without-sub-card";
import { TerminatedCard } from "./terminated-card";
import { TotalCostCard } from "./total-cost-card";

/**
 * formatCurrency
 * Formats an amount in the given currency
 */
function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency, "en", 0);
}

/**
 * BentoTotalCostCard
 * Total cost KPI card (Bento style)
 */
interface BentoTotalCostCardProps {
  data: TotalCostKpiData;
  isReadOnly?: boolean;
}

export function BentoTotalCostCard({
  data,
  isReadOnly = false,
}: BentoTotalCostCardProps) {
  const t = useTranslations("dashboardV3.kpi.totalCost");
  const { baseCurrency } = useBaseCurrency();

  const cardContent = (
    <Card className="border-l-primary/50 h-full border-l-4 transition-all">
      <CardContent className="flex h-full flex-col justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-2">
            <DollarSign className="text-primary h-4 w-4" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            {t("title")}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-3xl font-bold">
            {formatCurrency(data.amount, baseCurrency)}
          </p>
          {data.changePercent !== 0 && (
            <div className="mt-1">
              <TrendBadge
                value={data.changePercent}
                label={t("vsLastMonth")}
                variant="inline"
                positiveDirection="down"
                iconSize="sm"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isReadOnly) return cardContent;

  return (
    <Link
      href="/reports/cost"
      aria-label={t("ariaLabel")}
      className="block h-full"
    >
      <Card className="border-l-primary/50 h-full cursor-pointer border-l-4 transition-all">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 rounded-lg p-2">
              <DollarSign className="text-primary h-4 w-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium">
              {t("title")}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold">
              {formatCurrency(data.amount, baseCurrency)}
            </p>
            {data.changePercent !== 0 && (
              <div className="mt-1">
                <TrendBadge
                  value={data.changePercent}
                  label={t("vsLastMonth")}
                  variant="inline"
                  positiveDirection="down"
                  iconSize="sm"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * BentoAnomalyCard
 * Anomalies KPI card (Bento style)
 */
interface BentoAnomalyCardProps {
  data: AnomalyKpiData;
  isReadOnly?: boolean;
}

export function BentoAnomalyCard({
  data,
  isReadOnly = false,
}: BentoAnomalyCardProps) {
  const t = useTranslations("dashboardV3.kpi.anomaly");

  const cardContent = (
    <Card className="border-l-primary/50 h-full border-l-4 transition-all">
      <CardContent className="flex h-full flex-col justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-lg p-2">
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            {t("title")}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-3xl font-bold">{data.count}</p>
          <p className="text-muted-foreground text-xs">
            {data.count > 0 ? t("hasAnomalies") : t("noAnomalies")}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (isReadOnly) return cardContent;

  return (
    <Link
      href="/reports/cost"
      aria-label={t("ariaLabel")}
      className="block h-full"
    >
      <Card className="border-l-primary/50 h-full cursor-pointer border-l-4 transition-all">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="bg-muted rounded-lg p-2">
              <AlertTriangle className="text-muted-foreground h-4 w-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium">
              {t("title")}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold">{data.count}</p>
            <p className="text-muted-foreground text-xs">
              {data.count > 0 ? t("hasAnomalies") : t("noAnomalies")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * BentoTerminatedCard
 * Unrecovered offboarded-user accounts KPI card (Bento style)
 */
interface BentoTerminatedCardProps {
  data: TerminatedKpiData;
  isReadOnly?: boolean;
}

export function BentoTerminatedCard({
  data,
  isReadOnly = false,
}: BentoTerminatedCardProps) {
  const t = useTranslations("dashboardV3.kpi.terminated");
  const hasIssue = data.count > 0 && data.appCount > 0;

  const cardContent = (
    <Card className="border-l-primary/50 h-full border-l-4 transition-all">
      <CardContent className="flex h-full flex-col justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-lg p-2">
            <UserMinus className="text-muted-foreground h-4 w-4" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            {t("title")}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-3xl font-bold">{data.count}</p>
          <p className="text-muted-foreground text-xs">
            {hasIssue
              ? t("subAccess", { count: data.appCount })
              : t("allRecovered")}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (isReadOnly) return cardContent;

  return (
    <Link
      href="/users/offboarded"
      aria-label={t("ariaLabel")}
      className="block h-full"
    >
      <Card className="border-l-primary/50 h-full cursor-pointer border-l-4 transition-all">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="bg-muted rounded-lg p-2">
              <UserMinus className="text-muted-foreground h-4 w-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium">
              {t("title")}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold">{data.count}</p>
            <p className="text-muted-foreground text-xs">
              {hasIssue
                ? t("subAccess", { count: data.appCount })
                : t("allRecovered")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * BentoAppsWithoutSubCard
 * Apps without a subscription KPI card (Bento style)
 */
interface BentoAppsWithoutSubCardProps {
  data: AppsWithoutSubKpiData;
  isReadOnly?: boolean;
}

export function BentoAppsWithoutSubCard({
  data,
  isReadOnly = false,
}: BentoAppsWithoutSubCardProps) {
  const t = useTranslations("dashboardV3.kpi.appsWithoutSub");
  const hasAppsWithoutSub = data.count > 0;

  const cardContent = (
    <Card className="border-l-primary/50 h-full border-l-4 transition-all">
      <CardContent className="flex h-full flex-col justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="bg-muted rounded-lg p-2">
            <PackageX className="text-muted-foreground h-4 w-4" />
          </div>
          <span className="text-muted-foreground text-xs font-medium">
            {t("title")}
          </span>
        </div>
        <div className="mt-2">
          <p className="text-3xl font-bold">{data.count}</p>
          <p className="text-muted-foreground text-xs">
            {hasAppsWithoutSub
              ? t("detail", {
                  total: data.totalActiveApps,
                  count: data.count,
                })
              : t("allLinked")}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (isReadOnly) return cardContent;

  return (
    <Link
      href="/apps?filter=no-subscription"
      aria-label={t("ariaLabel")}
      className="block h-full"
    >
      <Card className="border-l-primary/50 h-full cursor-pointer border-l-4 transition-all">
        <CardContent className="flex h-full flex-col justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="bg-muted rounded-lg p-2">
              <PackageX className="text-muted-foreground h-4 w-4" />
            </div>
            <span className="text-muted-foreground text-xs font-medium">
              {t("title")}
            </span>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-bold">{data.count}</p>
            <p className="text-muted-foreground text-xs">
              {hasAppsWithoutSub
                ? t("detail", {
                    total: data.totalActiveApps,
                    count: data.count,
                  })
                : t("allLinked")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * BentoKpiCards
 * Shows the four KPI cards in a Bento grid layout
 */
interface BentoKpiCardsProps {
  totalCost: TotalCostKpiData;
  anomaly: AnomalyKpiData;
  terminated: TerminatedKpiData;
  appsWithoutSub: AppsWithoutSubKpiData;
  isReadOnly?: boolean;
}

export function BentoKpiCards({
  totalCost,
  anomaly,
  terminated,
  appsWithoutSub,
  isReadOnly = false,
}: BentoKpiCardsProps) {
  return (
    <ResponsiveBentoGrid gap="md">
      <ResponsiveBentoItem cols={1} colsSm={3} colsMd={4} colsLg={3}>
        <TotalCostCard data={totalCost} isReadOnly={isReadOnly} />
      </ResponsiveBentoItem>
      <ResponsiveBentoItem cols={1} colsSm={3} colsMd={4} colsLg={3}>
        <AnomalyCard data={anomaly} isReadOnly={isReadOnly} />
      </ResponsiveBentoItem>
      <ResponsiveBentoItem cols={1} colsSm={3} colsMd={4} colsLg={3}>
        <TerminatedCard data={terminated} isReadOnly={isReadOnly} />
      </ResponsiveBentoItem>
      <ResponsiveBentoItem cols={1} colsSm={3} colsMd={4} colsLg={3}>
        <AppsWithoutSubCard data={appsWithoutSub} isReadOnly={isReadOnly} />
      </ResponsiveBentoItem>
    </ResponsiveBentoGrid>
  );
}
