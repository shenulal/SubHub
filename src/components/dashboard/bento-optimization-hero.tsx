"use client";

import { Card } from "@/components/ui/card";
import { DEFAULT_BASE_CURRENCY, formatMoney } from "@/lib/fx/convert";
import { cn } from "@/lib/utils";
import type { OptimizationHeroData } from "@/types/dashboard";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";

interface BentoOptimizationHeroProps {
  data: OptimizationHeroData;
  isReadOnly?: boolean;
  /** Organisation base currency (amounts are already in it). */
  currency?: string;
}

/**
 * StatSection - one figure of the hero: label, value + suffix on one line.
 */
function StatSection({
  label,
  value,
  suffix,
  subtext,
  href,
  isReadOnly = false,
  dividerClassName,
  className,
}: {
  label: string;
  value: string;
  suffix: string;
  subtext?: string;
  href?: string;
  isReadOnly?: boolean;
  /** Border classes separating this figure from its neighbours. */
  dividerClassName?: string;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-center gap-1 border-white/25 px-5 py-4",
        dividerClassName
      )}
    >
      <p className="truncate text-[0.8125rem] text-white/85" title={label}>
        {label}
      </p>
      <div className="flex min-w-0 items-baseline gap-1.5 text-white">
        <span
          className="shrink-0 text-2xl leading-tight font-medium tabular-nums"
          title={value}
        >
          {value}
        </span>
        <span
          className="min-w-0 truncate text-[0.8125rem] text-white/85"
          title={suffix}
        >
          {suffix}
        </span>
      </div>
      {subtext && (
        <p className="truncate text-xs text-white/70" title={subtext}>
          {subtext}
        </p>
      )}
    </div>
  );

  if (href && !isReadOnly) {
    return (
      <Link
        href={href}
        className={cn(
          "flex min-w-0 rounded-md transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return <div className={cn("flex min-w-0", className)}>{content}</div>;
}

/**
 * BentoOptimizationHero
 * Materio gradient banner with three figures: total optimisation opportunity,
 * unused seats and unused subscription cost. Stacks on narrow screens.
 */
export function BentoOptimizationHero({
  data,
  isReadOnly = false,
  currency = DEFAULT_BASE_CURRENCY,
}: BentoOptimizationHeroProps) {
  const t = useTranslations("dashboardV2Cost.hero");
  const locale = useLocale();
  const money = (amount: number) => formatMoney(amount, currency, locale);

  return (
    // Layout follows the dashboard container: stacked → total on top with two
    // halves below → three figures in one row on wide content areas.
    <Card className="optimization-hero-gradient grid gap-0 p-1 @xl:grid-cols-2 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      {/* 섹션 1: 총 최적화 기회 */}
      <StatSection
        label={t("title")}
        value={money(data.monthlySavings)}
        suffix={`${t("perMonth")} (${t("annualPossible", { amount: money(data.annualSavings) })})`}
        isReadOnly={isReadOnly}
        className="@xl:col-span-2 @4xl:col-span-1"
      />

      {/* 섹션 2: 미사용 Seat */}
      <StatSection
        label={t("unusedLicenses")}
        value={money(data.breakdown.unusedLicenses.amount)}
        suffix={t("perMonth")}
        href="/subscriptions?filter=unused"
        isReadOnly={isReadOnly}
        dividerClassName="border-t @4xl:border-t-0 @4xl:border-l"
      />

      {/* 섹션 3: 미사용 앱 */}
      <StatSection
        label={t("overProvisioned")}
        value={money(data.breakdown.unusedApps.amount)}
        suffix={t("perMonth")}
        href="/apps?filter=unused"
        isReadOnly={isReadOnly}
        dividerClassName="border-t @xl:border-l @4xl:border-t-0"
      />
    </Card>
  );
}
