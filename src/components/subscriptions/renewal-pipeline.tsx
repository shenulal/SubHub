// src/components/subscriptions/renewal-pipeline.tsx
"use client";

/**
 * Renewal pipeline (9.5): kanban columns (Overdue / This week / This month /
 * Later + Trial endings / Notice deadlines) with a list toggle. Lane colours
 * are semantic and work in both themes.
 */
import { Button } from "@/components/ui/button";
import {
  formatMoney,
  formatMoneyCompact,
} from "@/lib/services/discovery/money";
import { cn } from "@/lib/utils";
import type {
  PipelineLane,
  PipelineLaneKey,
  RenewalPipelineData,
} from "@/types/discovery";
import { AlertTriangle, Columns3, LayoutList } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { LANE_STYLES, RenewalPipelineCard } from "./renewal-pipeline-card";

type ViewMode = "board" | "list";

const PRIMARY_LANES: PipelineLaneKey[] = ["overdue", "week", "month", "later"];
const SECONDARY_LANES: PipelineLaneKey[] = ["trialEnding", "noticeDeadline"];

interface RenewalPipelineProps {
  data: RenewalPipelineData;
  initialView?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
}

interface LaneHeaderProps {
  lane: PipelineLane;
  title: string;
  baseCurrency: string;
  locale: string;
  monthlyLabel: string;
  annualLabel: string;
}

function LaneHeader({
  lane,
  title,
  baseCurrency,
  locale,
  monthlyLabel,
  annualLabel,
}: LaneHeaderProps) {
  const style = LANE_STYLES[lane.key];
  return (
    <header className="flex min-w-0 flex-col gap-1 px-1 pb-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", style.bar)} />
        <h3 className="text-foreground min-w-0 truncate text-[0.9375rem] font-medium">
          {title}
        </h3>
        <span
          className={cn(
            "ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums",
            style.chip
          )}
        >
          {lane.count}
        </span>
      </div>
      <p className="text-muted-foreground truncate text-[0.8125rem] tabular-nums">
        <span className="text-foreground font-medium">
          {formatMoney(lane.monthlyBase, baseCurrency, locale)}
        </span>{" "}
        {monthlyLabel} ·{" "}
        {formatMoneyCompact(lane.annualBase, baseCurrency, locale)}{" "}
        {annualLabel}
      </p>
    </header>
  );
}

export function RenewalPipeline({
  data,
  initialView = "board",
  onViewChange,
}: RenewalPipelineProps) {
  const t = useTranslations("discovery.pipeline");
  const locale = useLocale();
  const [view, setView] = useState<ViewMode>(initialView);

  const lanesByKey = Object.fromEntries(
    data.lanes.map((l) => [l.key, l])
  ) as Record<PipelineLaneKey, PipelineLane>;
  const laneTitle = (key: PipelineLaneKey) =>
    key === "week"
      ? t("lanes.week", { days: data.weekDays })
      : key === "month"
        ? t("lanes.month", { days: data.monthDays })
        : t(`lanes.${key}`);

  const switchView = (next: ViewMode) => {
    setView(next);
    onViewChange?.(next);
  };

  const renderLane = (key: PipelineLaneKey, compact: boolean) => {
    const lane = lanesByKey[key];
    if (!lane) return null;
    return (
      <section
        key={key}
        data-testid={`pipeline-lane-${key}`}
        className={cn(
          "bg-muted/60 flex min-w-0 flex-col rounded-lg p-3",
          compact
            ? "w-full"
            : "min-h-[16rem] w-[18rem] shrink-0 grow basis-[18rem]"
        )}
      >
        <LaneHeader
          lane={lane}
          title={laneTitle(key)}
          baseCurrency={data.baseCurrency}
          locale={locale}
          monthlyLabel={t("perMonth")}
          annualLabel={t("perYear")}
        />
        <div
          className={cn(
            "flex flex-col gap-3",
            compact && "md:grid md:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {lane.cards.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-md border border-dashed px-3 py-8 text-center text-[0.8125rem]">
              {t("laneEmpty")}
            </p>
          ) : (
            lane.cards.map((card) => (
              <RenewalPipelineCard
                key={`${key}-${card.id}`}
                card={card}
                lane={key}
                baseCurrency={data.baseCurrency}
                compact={compact}
              />
            ))
          )}
        </div>
      </section>
    );
  };

  return (
    <div
      className="min-w-0 space-y-6"
      data-testid="renewal-pipeline"
      data-view={view}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.9375rem]">
          <span>{t("subtitle", { currency: data.baseCurrency })}</span>
          {data.hasStaleRates && (
            <span className="tonal-warning inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[0.8125rem] font-medium whitespace-nowrap">
              <AlertTriangle className="size-3.5" />
              {t("staleRates")}
            </span>
          )}
        </p>
        <div
          className="bg-card inline-flex shrink-0 gap-1 rounded-md p-1 shadow-xs"
          role="tablist"
          aria-label={t("viewToggle")}
        >
          <Button
            role="tab"
            aria-selected={view === "board"}
            variant={view === "board" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 whitespace-nowrap"
            onClick={() => switchView("board")}
          >
            <Columns3 className="size-4" />
            {t("board")}
          </Button>
          <Button
            role="tab"
            aria-selected={view === "list"}
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3 whitespace-nowrap"
            onClick={() => switchView("list")}
          >
            <LayoutList className="size-4" />
            {t("list")}
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <>
          <div className="-mx-1 flex min-w-0 gap-6 overflow-x-auto px-1 pb-2">
            {PRIMARY_LANES.map((key) => renderLane(key, false))}
          </div>
          <div className="-mx-1 flex min-w-0 gap-6 overflow-x-auto px-1 pb-2">
            {SECONDARY_LANES.map((key) => renderLane(key, false))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {[...PRIMARY_LANES, ...SECONDARY_LANES].map((key) =>
            renderLane(key, true)
          )}
        </div>
      )}
    </div>
  );
}
