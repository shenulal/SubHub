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
import { FlaskConical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

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
      <Card className="bg-card flex h-[450px] flex-col gap-5 rounded-xl border p-5 shadow-xs">
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
    <Card
      className="bg-card flex h-[450px] flex-col gap-4 overflow-clip rounded-xl border p-5 shadow-xs"
      data-testid="upcoming-renewals"
    >
      <div className="flex items-start gap-1 whitespace-nowrap">
        <span className="text-foreground text-base font-semibold">
          {windowDays ? td("title", { days: windowDays }) : t("title30days")}
        </span>
        <span className="text-primary text-base font-semibold">
          {rows.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {rows.length === 0 && (
          <p className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
            {td("empty")}
          </p>
        )}
        {rows.map((item) => (
          <Link
            key={item.id}
            href={`/subscriptions/${item.id}`}
            className="bg-muted/50 hover:bg-muted flex items-center gap-2 overflow-clip rounded-lg p-2 transition-colors"
          >
            <div className="bg-card flex h-10 w-10 shrink-0 items-center justify-center rounded-md border">
              <Avatar className="h-[30px] w-[30px] rounded">
                {item.logoUrl ? (
                  <AvatarImage src={item.logoUrl} alt={item.appName} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary rounded text-sm font-semibold">
                  {getAppInitial(item.appName)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
              <span className="text-foreground flex items-center gap-1.5 truncate text-sm font-medium">
                {item.appName}
                {item.isTrial && (
                  <FlaskConical
                    className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
                    aria-label={td("trial")}
                  />
                )}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    item.days <= URGENT_DAYS
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-primary"
                  )}
                >
                  D-{item.days}
                </span>
                <div className="bg-border h-3 w-px" />
                <span className="text-muted-foreground text-sm tabular-nums">
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
