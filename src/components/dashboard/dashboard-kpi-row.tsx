// src/components/dashboard/dashboard-kpi-row.tsx
"use client";

/**
 * Bento KPI row (4.1): monthly spend, annual run-rate, active count, renewing
 * soon and pending-approval committed spend — all in base currency with a
 * stale-rate hint. The first tile is the hero (2 columns) for hierarchy.
 */
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

interface TileProps {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: typeof Wallet;
  href?: string;
  tone?: "hero" | "default" | "warning";
  className?: string;
  testId: string;
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
  className,
  testId,
}: TileProps) {
  const body = (
    <div
      data-testid={testId}
      className={cn(
        "relative flex h-full flex-col justify-between overflow-hidden rounded-xl border p-4 transition-shadow hover:shadow-md",
        tone === "hero" &&
          "bg-primary text-primary-foreground border-transparent shadow-[0_8px_24px_-12px_var(--primary)]",
        tone === "default" && "bg-card",
        tone === "warning" &&
          "border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30",
        className
      )}
    >
      {tone === "hero" && (
        <span className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      )}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-medium",
            tone === "hero"
              ? "text-primary-foreground/80"
              : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "hero"
              ? "text-primary-foreground/80"
              : "text-muted-foreground"
          )}
        />
      </div>
      <div className="mt-3">
        <span
          className={cn(
            "block font-semibold tracking-tight tabular-nums",
            tone === "hero" ? "text-3xl" : "text-2xl"
          )}
        >
          {value}
        </span>
        {hint && (
          <span
            className={cn(
              "mt-1 block text-xs",
              tone === "hero"
                ? "text-primary-foreground/80"
                : "text-muted-foreground"
            )}
          >
            {hint}
          </span>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="focus-visible:ring-primary block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      {body}
    </Link>
  ) : (
    body
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

  return (
    <section
      aria-label={t("region")}
      className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6"
    >
      <Tile
        testId="kpi-monthly-spend"
        className="col-span-2"
        tone="hero"
        label={t("monthlySpend")}
        value={money(kpis.monthlySpendBase)}
        icon={Wallet}
        href="/subscriptions"
        hint={
          <span className="inline-flex items-center gap-1">
            {t("annualRunRate")}:{" "}
            {formatMoneyCompact(kpis.annualRunRateBase, baseCurrency, locale)}
            {hasStaleRates && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">
                <AlertTriangle className="h-3 w-3" />
                {t("staleRates")}
              </span>
            )}
          </span>
        }
      />
      <Tile
        testId="kpi-annual-run-rate"
        label={t("annualRunRate")}
        value={formatMoneyCompact(kpis.annualRunRateBase, baseCurrency, locale)}
        icon={TrendingUp}
        hint={t("annualHint")}
      />
      <Tile
        testId="kpi-active-count"
        label={t("active")}
        value={String(kpis.activeCount)}
        icon={Layers}
        href="/subscriptions?status=ACTIVE"
        hint={t("activeHint")}
      />
      <Tile
        testId="kpi-renewing-soon"
        label={t("renewingSoon", { days: kpis.renewingSoonDays })}
        value={String(kpis.renewingSoonCount)}
        icon={CalendarClock}
        href={`/subscriptions?renewingWithin=${kpis.renewingSoonDays}`}
        tone={kpis.renewingSoonCount > 0 ? "warning" : "default"}
        hint={t("renewingHint")}
      />
      {showApprovals ? (
        <Tile
          testId="kpi-pending-approvals"
          label={t("pendingApprovals")}
          value={String(kpis.pendingApprovalsCount)}
          icon={ClipboardCheck}
          href="/approvals"
          hint={t("committed", {
            amount: money(kpis.pendingApprovalsMonthlyBase),
          })}
        />
      ) : (
        <div className="hidden xl:block" aria-hidden />
      )}
    </section>
  );
}
