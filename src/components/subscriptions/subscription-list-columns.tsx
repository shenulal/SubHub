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

/** Materio tonal Badge variant per status (semantic colour, light + dark safe). */
export const STATUS_BADGE_VARIANT: Record<
  SubscriptionStatus,
  "success" | "warning" | "info" | "secondary" | "outline"
> = {
  ACTIVE: "success",
  PENDING: "warning",
  PAUSED: "info",
  EXPIRED: "outline",
  CANCELLED: "secondary",
  ARCHIVED: "outline",
};

/** Extra per-status refinements on top of the Badge variant. */
export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "",
  PENDING: "",
  PAUSED: "",
  EXPIRED: "border-transparent bg-error/15 text-error",
  CANCELLED: "line-through decoration-muted-foreground/50",
  ARCHIVED: "border-dashed border-border bg-transparent text-muted-foreground",
};

/** Countdown tone thresholds (days). */
const URGENT_DAYS = 7;
const SOON_DAYS = 30;

export function countdownTone(days: number): string {
  if (days < 0) return "text-error";
  if (days <= URGENT_DAYS) return "text-warning";
  if (days <= SOON_DAYS) return "text-foreground";
  return "text-muted-foreground";
}

export function AppCell({ item }: { item: DiscoverySubscriptionItem }) {
  return (
    <div className="flex max-w-[13rem] min-w-[11rem] items-center gap-3 2xl:max-w-[15rem]">
      {item.appLogoUrl ? (
        <Image
          src={item.appLogoUrl}
          alt={item.appName}
          width={32}
          height={32}
          className="bg-background size-9 shrink-0 rounded-md border object-contain p-0.5"
        />
      ) : (
        <div className="tonal-primary flex size-9 shrink-0 items-center justify-center rounded-md text-[0.9375rem] font-medium">
          {item.appName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <Link
          href={`/subscriptions/${item.id}`}
          className="text-foreground hover:text-primary block truncate text-[0.9375rem] font-medium transition-colors"
          title={item.appName}
        >
          {item.appName}
        </Link>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {item.category ? (
            <CategoryBadge
              category={item.category}
              parentName={item.category.parentName}
              compact
              className="h-6 max-w-full min-w-0 px-2 text-xs"
            />
          ) : null}
          {item.isPersonal && (
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-0.5 text-xs">
              <User className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Tag chips shown in the list before collapsing into "+N". */
const TAGS_SHOWN = 1;

export function TagsCell({ item }: { item: DiscoverySubscriptionItem }) {
  if (!item.tags.length)
    return <span className="text-muted-foreground">—</span>;
  // One chip + "+N" keeps the column narrow; every name is in the tooltip.
  const shown = item.tags.slice(0, TAGS_SHOWN);
  const extra = item.tags.length - shown.length;
  return (
    <div
      className="flex min-w-max items-center gap-1"
      title={item.tags.map((tag) => tag.name).join(", ")}
    >
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="tonal-neutral inline-flex h-6 max-w-[8rem] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap"
          title={tag.name}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: tag.color ?? "var(--chart-2)" }}
          />
          <span className="truncate">{tag.name}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="text-muted-foreground shrink-0 text-xs font-medium">
          +{extra}
        </span>
      )}
    </div>
  );
}

export function OwnerCell({ item }: { item: DiscoverySubscriptionItem }) {
  const label = item.owner?.name ?? item.owner?.email ?? item.teamName;
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex max-w-[11rem] min-w-0 flex-col 2xl:max-w-[14rem]">
      <span className="text-foreground truncate text-[0.9375rem]" title={label}>
        {label}
      </span>
      {item.owner && item.teamName && (
        <span className="text-muted-foreground truncate text-[0.8125rem]">
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
  /** Shown next to the amount when the Cycle column is hidden (< 1536px). */
  cycleLabel?: string;
}

export function CostCell({
  item,
  baseCurrency,
  locale,
  monthlyLabel,
  cycleLabel,
}: CostCellProps) {
  const showBase =
    typeof item.monthlyAmountBase === "number" &&
    (item.currency !== baseCurrency || item.billingCycle !== "MONTHLY");
  return (
    <div className="flex flex-col items-end whitespace-nowrap tabular-nums">
      <span className="text-foreground text-[0.9375rem] font-medium">
        {formatMoney(item.amount, item.currency, locale)}
        {cycleLabel && (
          // The Cycle column is folded in here below 1536px to save width.
          <span className="text-muted-foreground ml-1 text-[0.8125rem] font-normal 2xl:hidden">
            · {cycleLabel}
          </span>
        )}
      </span>
      {showBase && (
        <span className="text-muted-foreground text-[0.8125rem]">
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
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span className="text-foreground text-[0.9375rem] tabular-nums">
        {renewal ? format(renewal, "yyyy-MM-dd") : "—"}
      </span>
      {countdown && (
        <span
          className={cn(
            "text-[0.8125rem] font-medium",
            countdownTone(days ?? 0)
          )}
        >
          {countdown}
        </span>
      )}
      <div className="flex flex-wrap gap-1 empty:hidden">
        {item.isTrial && (
          <Badge variant="primary" className="h-5 gap-1 px-2 text-[0.6875rem]">
            <FlaskConical className="h-3 w-3" />
            {labels.trial}
            {trial && ` · ${format(trial, "MM-dd")}`}
          </Badge>
        )}
        {notice && (
          <Badge variant="warning" className="h-5 gap-1 px-2 text-[0.6875rem]">
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
          cycleLabel={labels.cycleLabel(item.billingCycle)}
        />
      ),
    },
    {
      id: "cycle",
      header: labels.cycle,
      className: "hidden 2xl:table-cell",
      headerClassName: "hidden 2xl:table-cell",
      cell: (item) => (
        <span className="text-muted-foreground text-[0.9375rem] whitespace-nowrap">
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
          variant={STATUS_BADGE_VARIANT[item.status]}
          className={cn(
            "h-6 px-2.5 text-[0.8125rem]",
            STATUS_STYLES[item.status]
          )}
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
