"use client";

/**
 * Upcoming renewals (4.1): top N renewals inside the `discovery.renewingSoonDays`
 * window, in base currency when the overview is available. Falls back to the
 * legacy V3 renewal list so the widget keeps working without the overview.
 */
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/services/discovery/money";
import { cn } from "@/lib/utils";
import type { RenewalItem } from "@/types/dashboard";
import type { DashboardRenewalRow } from "@/types/discovery";
import { CalendarCheck, FlaskConical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { DashboardEmptyState } from "./dashboard-empty-state";

const CARD_CLASSES = "h-[440px] gap-4 overflow-clip px-5";

export type { RenewalItem };

const URGENT_DAYS = 7;
const LEGACY_LIMIT = 5;

interface UpcomingRenewalsProps {
  data: RenewalItem[];
  overviewRenewals?: DashboardRenewalRow[];
  baseCurrency?: string;
  windowDays?: number;
  isLoading?: boolean;
}

interface Row {
  id: string;
  appName: string;
  logoUrl?: string | null;
  days: number;
  amountLabel: string;
  isTrial: boolean;
}

function getAppInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function UpcomingRenewals({
  data,
  overviewRenewals,
  baseCurrency,
  windowDays,
  isLoading,
}: UpcomingRenewalsProps) {
  const t = useTranslations("dashboardV2Cost.renewals");
  const td = useTranslations("discovery.dashboard.renewals");
  const locale = useLocale();

  const rows = useMemo<Row[]>(() => {
    if (overviewRenewals && baseCurrency) {
      return overviewRenewals.map((r) => ({
        id: r.id,
        appName: r.appName,
        logoUrl: r.appLogoUrl,
        days: r.daysUntilRenewal,
        amountLabel: formatMoney(r.amountBase, baseCurrency, locale),
        isTrial: r.isTrial,
      }));
    }
    return data.slice(0, LEGACY_LIMIT).map((r) => ({
      id: r.id,
      appName: r.appName,
      logoUrl: r.logoUrl,
      days: r.daysUntilRenewal,
      amountLabel: `$${new Intl.NumberFormat("en-US").format(r.renewalCost)}`,
      isTrial: false,
    }));
  }, [overviewRenewals, baseCurrency, data, locale]);

  if (isLoading) {
    return (
      <Card className={CARD_CLASSES}>
        <Skeleton className="h-6 w-48" />
        <div className="flex flex-1 flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className={CARD_CLASSES} data-testid="upcoming-renewals">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <span
          className="text-foreground min-w-0 truncate text-lg font-medium"
          title={
            windowDays ? td("title", { days: windowDays }) : t("title30days")
          }
        >
          {windowDays ? td("title", { days: windowDays }) : t("title30days")}
        </span>
        <span className="tonal-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          {rows.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {rows.length === 0 && (
          <DashboardEmptyState icon={CalendarCheck} message={td("empty")} />
        )}
        {rows.map((item) => (
          <Link
            key={item.id}
            href={`/subscriptions/${item.id}`}
            className="hover:bg-muted flex min-w-0 items-center gap-3 overflow-clip rounded-md p-2 transition-colors"
          >
            <div className="bg-card flex size-10 shrink-0 items-center justify-center rounded-md border">
              <Avatar className="h-[30px] w-[30px] rounded">
                {item.logoUrl ? (
                  <AvatarImage src={item.logoUrl} alt={item.appName} />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-primary rounded text-sm font-medium">
                  {getAppInitial(item.appName)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
              <span className="text-foreground flex min-w-0 items-center gap-1.5 text-sm font-medium">
                <span className="truncate" title={item.appName}>
                  {item.appName}
                </span>
                {item.isTrial && (
                  <FlaskConical
                    className="text-primary size-3.5 shrink-0"
                    aria-label={td("trial")}
                  />
                )}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "shrink-0 text-[0.8125rem] font-medium tabular-nums",
                    item.days <= URGENT_DAYS ? "text-warning" : "text-primary"
                  )}
                >
                  D-{item.days}
                </span>
                <div className="bg-border h-3 w-px shrink-0" />
                <span
                  className="text-muted-foreground truncate text-[0.8125rem] tabular-nums"
                  title={item.amountLabel}
                >
                  {item.amountLabel}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
