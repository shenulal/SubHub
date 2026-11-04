// src/components/subscriptions/subscription-list-columns.tsx
"use client";

/**
 * Column definitions and cell renderers for the subscription list.
 */
import type { DataTableColumn } from "@/components/common/data-table";
import { CategoryBadge } from "@/components/taxonomy/category-badge";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/services/discovery/money";
import { daysBetweenUtc } from "@/lib/services/discovery/pipeline-buckets";
import { cn } from "@/lib/utils";
import type { DiscoverySubscriptionItem } from "@/types/discovery";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { format } from "date-fns";
import { FlaskConical, ShieldAlert, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Light + dark safe status styling (semantic colour, not just decoration). */
export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300",
  PENDING:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300",
  PAUSED:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300",
  EXPIRED:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300",
  CANCELLED:
    "border-border bg-muted text-muted-foreground line-through decoration-muted-foreground/50",
  ARCHIVED: "border-dashed border-border bg-transparent text-muted-foreground",
};

/** Countdown tone thresholds (days). */
const URGENT_DAYS = 7;
const SOON_DAYS = 30;

export function countdownTone(days: number): string {
  if (days < 0) return "text-rose-600 dark:text-rose-400";
  if (days <= URGENT_DAYS) return "text-amber-600 dark:text-amber-400";
  if (days <= SOON_DAYS) return "text-foreground";
  return "text-muted-foreground";
}

export function AppCell({ item }: { item: DiscoverySubscriptionItem }) {
  return (
    <div className="flex items-center gap-3">
      {item.appLogoUrl ? (
        <Image
          src={item.appLogoUrl}
          alt={item.appName}
          width={32}
          height={32}
          className="h-8 w-8 rounded-md border object-contain"
        />
      ) : (
        <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold">
          {item.appName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <Link
          href={`/subscriptions/${item.id}`}
          className="block truncate font-medium hover:underline"
        >
          {item.appName}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5">
          {item.category ? (
            <CategoryBadge
              category={item.category}
              parentName={item.category.parentName}
              className="h-5 text-[11px]"
            />
          ) : null}
          {item.isPersonal && (
            <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px]">
              <User className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TagsCell({ item }: { item: DiscoverySubscriptionItem }) {
  if (!item.tags.length)
    return <span className="text-muted-foreground">—</span>;
  const shown = item.tags.slice(0, 3);
  const extra = item.tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="bg-muted inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px]"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: tag.color ?? "var(--chart-2)" }}
          />
          {tag.name}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-muted-foreground text-[11px]">+{extra}</span>
      )}
    </div>
  );
}

export function OwnerCell({ item }: { item: DiscoverySubscriptionItem }) {
  const label = item.owner?.name ?? item.owner?.email ?? item.teamName;
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm">{label}</span>
      {item.owner && item.teamName && (
        <span className="text-muted-foreground truncate text-[11px]">
          {item.teamName}
        </span>
      )}
    </div>
  );
}

interface CostCellProps {
  item: DiscoverySubscriptionItem;
  baseCurrency: string;
  locale: string;
  monthlyLabel: string;
}

export function CostCell({
  item,
  baseCurrency,
  locale,
  monthlyLabel,
}: CostCellProps) {
  const showBase =
    typeof item.monthlyAmountBase === "number" &&
    (item.currency !== baseCurrency || item.billingCycle !== "MONTHLY");
  return (
    <div className="flex flex-col items-end tabular-nums">
      <span className="font-medium">
        {formatMoney(item.amount, item.currency, locale)}
      </span>
      {showBase && (
        <span className="text-muted-foreground text-[11px]">
          ≈ {formatMoney(item.monthlyAmountBase ?? 0, baseCurrency, locale)}{" "}
          {monthlyLabel}
        </span>
      )}
    </div>
  );
}

interface RenewalCellProps {
  item: DiscoverySubscriptionItem;
  now: Date;
  labels: {
    overdue: (days: number) => string;
    inDays: (days: number) => string;
    today: string;
    trial: string;
    notice: string;
  };
}

export function RenewalCell({ item, now, labels }: RenewalCellProps) {
  const renewal = item.renewalDate ? new Date(item.renewalDate) : null;
  const trial = item.trialEndsAt ? new Date(item.trialEndsAt) : null;
  const notice = item.cancellationDeadline
    ? new Date(item.cancellationDeadline)
    : null;
  const days = renewal ? daysBetweenUtc(now, renewal) : null;
  const countdown =
    days === null
      ? null
      : days === 0
        ? labels.today
        : days < 0
          ? labels.overdue(Math.abs(days))
          : labels.inDays(days);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm">
        {renewal ? format(renewal, "yyyy-MM-dd") : "—"}
      </span>
      {countdown && (
        <span
          className={cn("text-[11px] font-medium", countdownTone(days ?? 0))}
        >
          {countdown}
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {item.isTrial && (
          <Badge
            variant="outline"
            className="h-5 gap-1 border-violet-200 bg-violet-50 px-1.5 text-[10px] text-violet-700 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300"
          >
            <FlaskConical className="h-3 w-3" />
            {labels.trial}
            {trial && ` · ${format(trial, "MM-dd")}`}
          </Badge>
        )}
        {notice && (
          <Badge
            variant="outline"
            className="h-5 gap-1 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
          >
            <ShieldAlert className="h-3 w-3" />
            {labels.notice} {format(notice, "MM-dd")}
          </Badge>
        )}
      </div>
    </div>
  );
}

export interface ColumnLabels {
  app: string;
  tags: string;
  owner: string;
  cost: string;
  cycle: string;
  status: string;
  renewal: string;
  monthly: string;
  statusLabel: (status: SubscriptionStatus) => string;
  cycleLabel: (cycle: BillingCycle) => string;
  renewal_labels: RenewalCellProps["labels"];
}

interface BuildColumnsArgs {
  labels: ColumnLabels;
  baseCurrency: string;
  locale: string;
  now: Date;
  renderActions: (item: DiscoverySubscriptionItem) => ReactNode;
}

export function buildSubscriptionColumns({
  labels,
  baseCurrency,
  locale,
  now,
  renderActions,
}: BuildColumnsArgs): DataTableColumn<DiscoverySubscriptionItem>[] {
  return [
    {
      id: "app",
      header: labels.app,
      sortable: true,
      cell: (item) => <AppCell item={item} />,
    },
    {
      id: "tags",
      header: labels.tags,
      cell: (item) => <TagsCell item={item} />,
    },
    {
      id: "owner",
      header: labels.owner,
      sortable: true,
      cell: (item) => <OwnerCell item={item} />,
    },
    {
      id: "cost",
      header: labels.cost,
      sortable: true,
      className: "text-right",
      headerClassName: "text-right",
      cell: (item) => (
        <CostCell
          item={item}
          baseCurrency={baseCurrency}
          locale={locale}
          monthlyLabel={labels.monthly}
        />
      ),
    },
    {
      id: "cycle",
      header: labels.cycle,
      cell: (item) => (
        <span className="text-muted-foreground text-sm">
          {labels.cycleLabel(item.billingCycle)}
        </span>
      ),
    },
    {
      id: "status",
      header: labels.status,
      sortable: true,
      cell: (item) => (
        <Badge
          variant="outline"
          className={cn("h-5 px-2 text-[11px]", STATUS_STYLES[item.status])}
        >
          {labels.statusLabel(item.status)}
        </Badge>
      ),
    },
    {
      id: "renewal",
      header: labels.renewal,
      sortable: true,
      cell: (item) => (
        <RenewalCell item={item} now={now} labels={labels.renewal_labels} />
      ),
    },
    {
      id: "actions",
      header: "",
      headerClassName: "w-[48px]",
      className: "text-right",
      cell: (item) => renderActions(item),
    },
  ];
}
