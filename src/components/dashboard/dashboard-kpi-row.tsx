// src/components/dashboard/dashboard-kpi-row.tsx
"use client";

/**
 * KPI row (4.1): monthly spend, annual run-rate, active count, renewing soon
 * and pending-approval committed spend — all in base currency with a
 * stale-rate hint. Materio card-statistics layout: icon tile, single-line
 * title / value / caption, equal-height cards in a container-aware grid.
 */
import { Card } from "@/components/ui/card";
import {
  formatMoney,
  formatMoneyCompact,
} from "@/lib/services/discovery/money";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/types/discovery";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Layers,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";

interface DashboardKpiRowProps {
  kpis: DashboardKpis;
  baseCurrency: string;
  hasStaleRates: boolean;
  /** Personal mode hides the approvals tile. */
  showApprovals: boolean;
}

type Tone = "hero" | "default" | "warning" | "info" | "success";

interface TileProps {
  label: string;
  value: string;
  hint?: ReactNode;
  /** Plain-text version of `hint` for the native tooltip when truncated. */
  hintTitle?: string;
  /** Optional chip rendered next to the icon tile (e.g. stale-rate warning). */
  badge?: ReactNode;
  icon: typeof Wallet;
  href?: string;
  tone?: Tone;
  className?: string;
  testId: string;
}

const ICON_TONE: Record<Tone, string> = {
  hero: "tonal-primary",
  default: "tonal-info",
  info: "tonal-info",
  success: "tonal-success",
  warning: "tonal-warning",
};

function Tile({
  label,
  value,
  hint,
  hintTitle,
  badge,
  icon: Icon,
  href,
  tone = "default",
  className,
  testId,
}: TileProps) {
  const body = (
    <Card
      data-testid={testId}
      className={cn(
        "h-full gap-4 px-5 transition-shadow",
        href && "group-hover:shadow-lg"
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md",
            ICON_TONE[tone]
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        {badge}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span
          className="text-muted-foreground truncate text-[0.8125rem]"
          title={label}
        >
          {label}
        </span>
        <span
          className={cn(
            "text-foreground truncate text-2xl leading-tight font-medium tabular-nums",
            tone === "warning" && "text-warning"
          )}
          title={value}
        >
          {value}
        </span>
        {hint && (
          <span
            className="text-muted-foreground block truncate text-[0.8125rem]"
            title={hintTitle}
          >
            {hint}
          </span>
        )}
      </div>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className={cn(
        "group focus-visible:ring-primary block h-full min-w-0 rounded-lg focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn("h-full min-w-0", className)}>{body}</div>
  );
}

export function DashboardKpiRow({
  kpis,
  baseCurrency,
  hasStaleRates,
  showApprovals,
}: DashboardKpiRowProps) {
  const t = useTranslations("discovery.dashboard.kpi");
  const locale = useLocale();
  const money = (v: number) => formatMoney(v, baseCurrency, locale);
  const runRate = formatMoneyCompact(
    kpis.annualRunRateBase,
    baseCurrency,
    locale
  );
  const committed = t("committed", {
    amount: money(kpis.pendingApprovalsMonthlyBase),
  });

  // Five tiles: the hero spans two columns whenever the grid has 2+ columns so
  // every row is filled (2 → [MM][AA][AA], 3 → [MMA][AAA], 6 → [MMAAAA]).
  // Four tiles (personal mode): plain 2 / 4 column grid, no span.
  const heroSpan = showApprovals ? "@md:col-span-2" : undefined;

  return (
    <div className="@container">
      <section
        aria-label={t("region")}
        className={cn(
          "grid grid-cols-1 gap-6",
          showApprovals
            ? "@md:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-6"
            : "@md:grid-cols-2 @4xl:grid-cols-4"
        )}
      >
        <Tile
          testId="kpi-monthly-spend"
          className={heroSpan}
          tone="hero"
          label={t("monthlySpend")}
          value={money(kpis.monthlySpendBase)}
          icon={Wallet}
          href="/subscriptions"
          badge={
            hasStaleRates ? (
              <span
                className="tonal-warning inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                title={t("staleRates")}
              >
                <AlertTriangle className="size-3" aria-hidden />
                {t("staleRates")}
              </span>
            ) : undefined
          }
          hintTitle={`${t("annualRunRate")}: ${runRate}`}
          hint={
            <>
              {t("annualRunRate")}: {runRate}
            </>
          }
        />
        <Tile
          testId="kpi-annual-run-rate"
          label={t("annualRunRate")}
          value={runRate}
          icon={TrendingUp}
          tone="success"
          hint={t("annualHint")}
          hintTitle={t("annualHint")}
        />
        <Tile
          testId="kpi-active-count"
          label={t("active")}
          value={String(kpis.activeCount)}
          icon={Layers}
          href="/subscriptions?status=ACTIVE"
          tone="info"
          hint={t("activeHint")}
          hintTitle={t("activeHint")}
        />
        <Tile
          testId="kpi-renewing-soon"
          label={t("renewingSoon", { days: kpis.renewingSoonDays })}
          value={String(kpis.renewingSoonCount)}
          icon={CalendarClock}
          href={`/subscriptions?renewingWithin=${kpis.renewingSoonDays}`}
          tone={kpis.renewingSoonCount > 0 ? "warning" : "default"}
          hint={t("renewingHint")}
          hintTitle={t("renewingHint")}
        />
        {showApprovals && (
          <Tile
            testId="kpi-pending-approvals"
            label={t("pendingApprovals")}
            value={String(kpis.pendingApprovalsCount)}
            icon={ClipboardCheck}
            href="/approvals"
            tone="hero"
            hint={committed}
            hintTitle={committed}
          />
        )}
      </section>
    </div>
  );
}
