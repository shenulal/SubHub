// src/components/super-admin/analytics/analytics-panels.tsx
/** Small analytics cards: ranked breakdowns, approvals summary, FX note. */
import { cn } from "@/lib/utils";
import type { ApprovalsSummary } from "@/types/platform-analytics";
import { ClipboardCheck, type LucideIcon } from "lucide-react";

import { formatCount } from "../format";
import { ChartCard } from "./chart-card";
import { RankedList, type RankedItem } from "./ranked-list";

const HOURS_PER_DAY = 24;
const DAYS_THRESHOLD_HOURS = 48;

interface BreakdownCardProps {
  title: string;
  caption?: string;
  items: RankedItem[];
  emptyIcon: LucideIcon;
  emptyMessage: string;
  barClassName?: string;
  testId?: string;
  className?: string;
}

export function BreakdownCard({
  title,
  caption,
  items,
  emptyIcon,
  emptyMessage,
  barClassName,
  testId,
  className,
}: BreakdownCardProps) {
  return (
    <ChartCard
      title={title}
      caption={caption}
      className={cn("h-[380px]", className)}
      testId={testId}
      empty={
        items.length === 0 ? { icon: emptyIcon, message: emptyMessage } : null
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <RankedList items={items} barClassName={barClassName} />
      </div>
    </ChartCard>
  );
}

export function formatDuration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < DAYS_THRESHOLD_HOURS) return `${hours.toFixed(1)} h`;
  return `${(hours / HOURS_PER_DAY).toFixed(1)} days`;
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <p className="text-muted-foreground truncate text-[0.8125rem]">{label}</p>
      <p
        className={`truncate text-2xl font-medium tabular-nums ${tone}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function ApprovalsCard({
  approvals,
  periodLabel,
  className,
}: {
  approvals: ApprovalsSummary;
  periodLabel: string;
  className?: string;
}) {
  const total =
    approvals.pending +
    approvals.submitted +
    approvals.approved +
    approvals.rejected;
  return (
    <ChartCard
      title="Approvals"
      caption={`Pending now; other figures for the ${periodLabel.toLowerCase()}`}
      className={cn("h-[380px]", className)}
      testId="analytics-approvals"
      empty={
        total === 0
          ? { icon: ClipboardCheck, message: "No approval requests yet." }
          : null
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label="Pending"
          value={formatCount(approvals.pending)}
          tone="text-warning"
        />
        <Figure
          label="Submitted"
          value={formatCount(approvals.submitted)}
          tone="text-foreground"
        />
        <Figure
          label="Approved"
          value={formatCount(approvals.approved)}
          tone="text-success"
        />
        <Figure
          label="Rejected"
          value={formatCount(approvals.rejected)}
          tone="text-destructive"
        />
      </div>
      <div className="bg-muted flex min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2.5">
        <span className="text-muted-foreground truncate text-[0.8125rem]">
          Average decision time
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {formatDuration(approvals.avgDecisionHours)}
        </span>
      </div>
    </ChartCard>
  );
}

export function StaleRatesNote() {
  return (
    <p className="tonal-warning rounded-md px-3 py-2 text-[0.8125rem]">
      Some exchange rates are missing or out of date, so converted totals may be
      approximate.
    </p>
  );
}
