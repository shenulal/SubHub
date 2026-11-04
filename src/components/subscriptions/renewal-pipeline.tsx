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
    <header className="flex flex-col gap-1 px-1 pb-2">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", style.bar)} />
        <h3 className="text-sm font-semibold">{title}</h3>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold",
            style.chip
          )}
        >
          {lane.count}
        </span>
      </div>
      <p className="text-muted-foreground text-[11px] tabular-nums">
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
          "bg-muted/40 flex min-w-0 flex-col rounded-xl border p-2",
          compact ? "w-full" : "min-h-[16rem]"
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
            "flex flex-col gap-2",
            compact && "md:grid md:grid-cols-2 xl:grid-cols-3"
          )}
        >
          {lane.cards.length === 0 ? (
            <p className="text-muted-foreground px-1 py-6 text-center text-xs">
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
    <div className="space-y-4" data-testid="renewal-pipeline" data-view={view}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {t("subtitle", { currency: data.baseCurrency })}
          {data.hasStaleRates && (
            <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("staleRates")}
            </span>
          )}
        </p>
        <div
          className="bg-muted inline-flex rounded-md p-0.5"
          role="tablist"
          aria-label={t("viewToggle")}
        >
          <Button
            role="tab"
            aria-selected={view === "board"}
            variant={view === "board" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => switchView("board")}
          >
            <Columns3 className="mr-1 h-3.5 w-3.5" />
            {t("board")}
          </Button>
          <Button
            role="tab"
            aria-selected={view === "list"}
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => switchView("list")}
          >
            <LayoutList className="mr-1 h-3.5 w-3.5" />
            {t("list")}
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PRIMARY_LANES.map((key) => renderLane(key, false))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {SECONDARY_LANES.map((key) => renderLane(key, false))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {[...PRIMARY_LANES, ...SECONDARY_LANES].map((key) =>
            renderLane(key, true)
          )}
        </div>
      )}
    </div>
  );
}
