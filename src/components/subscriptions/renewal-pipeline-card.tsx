// src/components/subscriptions/renewal-pipeline-card.tsx
"use client";

/**
 * Kanban card for the renewal pipeline (9.5): logo, cost, owner, days left and
 * quick actions (view, pause/archive gated by permission).
 */
import {
  archiveSubscription,
  pauseSubscription,
} from "@/actions/subscriptions/subscription-lifecycle";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/services/discovery/money";
import { cn } from "@/lib/utils";
import type {
  PipelineCard as PipelineCardData,
  PipelineLaneKey,
} from "@/types/discovery";
import { format } from "date-fns";
import {
  Archive,
  FlaskConical,
  MoreHorizontal,
  Pause,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

/** Lane accent colours — Materio semantic tokens, light + dark safe. */
export const LANE_STYLES: Record<
  PipelineLaneKey,
  { bar: string; chip: string; text: string }
> = {
  overdue: { bar: "bg-error", chip: "tonal-error", text: "text-error" },
  week: { bar: "bg-warning", chip: "tonal-warning", text: "text-warning" },
  month: { bar: "bg-primary", chip: "tonal-primary", text: "text-primary" },
  later: {
    bar: "bg-neutral",
    chip: "tonal-neutral",
    text: "text-muted-foreground",
  },
  trialEnding: { bar: "bg-info", chip: "tonal-info", text: "text-info" },
  noticeDeadline: {
    bar: "bg-warning",
    chip: "tonal-warning",
    text: "text-warning",
  },
};

interface RenewalPipelineCardProps {
  card: PipelineCardData;
  lane: PipelineLaneKey;
  baseCurrency: string;
  compact?: boolean;
}

export function RenewalPipelineCard({
  card,
  lane,
  baseCurrency,
  compact = false,
}: RenewalPipelineCardProps) {
  const t = useTranslations("discovery.pipeline");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const style = LANE_STYLES[lane];

  const daysLabel =
    card.daysLeft < 0
      ? t("daysOverdue", { days: Math.abs(card.daysLeft) })
      : card.daysLeft === 0
        ? t("dueToday")
        : t("daysLeft", { days: card.daysLeft });

  const run = (
    fn: (id: string) => Promise<{ success: boolean; error?: string }>,
    key: string
  ) =>
    startTransition(async () => {
      const result = await fn(card.id);
      if (result.success) {
        toast.success(t(key, { appName: card.appName }));
        router.refresh();
      } else {
        toast.error(result.error ?? t("actionFailed"));
      }
    });

  return (
    <article
      data-testid="pipeline-card"
      className={cn(
        "bg-card group relative flex min-w-0 gap-3 overflow-hidden rounded-lg p-4 shadow-xs transition-shadow hover:shadow-md",
        compact && "items-center py-3"
      )}
    >
      <span
        className={cn(
          "absolute top-4 bottom-4 left-0 w-1 rounded-r",
          style.bar
        )}
      />
      {card.appLogoUrl ? (
        <Image
          src={card.appLogoUrl}
          alt={card.appName}
          width={36}
          height={36}
          className="bg-background size-10 shrink-0 rounded-md border object-contain p-0.5"
        />
      ) : (
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md text-[0.9375rem] font-medium">
          {card.appName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <Link
            href={`/subscriptions/${card.id}`}
            className="text-foreground hover:text-primary min-w-0 truncate text-[0.9375rem] font-medium transition-colors"
            title={card.appName}
          >
            {card.appName}
          </Link>
          <span
            className={cn(
              "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap tabular-nums",
              style.chip
            )}
          >
            {daysLabel}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem]">
          <span className="text-foreground font-medium whitespace-nowrap tabular-nums">
            {formatMoney(card.amount, card.currency, locale)}
          </span>
          {card.currency !== baseCurrency && (
            <span className="text-muted-foreground whitespace-nowrap tabular-nums">
              ≈ {formatMoney(card.monthlyBase, baseCurrency, locale)}{" "}
              {t("perMonth")}
            </span>
          )}
          <span className="text-muted-foreground whitespace-nowrap">
            {format(new Date(card.dueDate), "MMM d")}
          </span>
          {card.isTrial && (
            <span
              className={cn(
                "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-medium whitespace-nowrap",
                LANE_STYLES.trialEnding.chip
              )}
            >
              <FlaskConical className="h-3 w-3" />
              {t("trial")}
            </span>
          )}
        </div>
        {!compact && (card.owner || card.teamName) && (
          <div className="text-muted-foreground mt-2 flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
            <User className="size-3.5 shrink-0" />
            <span className="truncate">
              {card.owner?.name ?? card.teamName}
            </span>
          </div>
        )}
      </div>
      <Can permission="subscriptions:update">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 -mr-2 size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              disabled={isPending}
              aria-label={t("quickActions", { appName: card.appName })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <Link href={`/subscriptions/${card.id}/edit`}>{t("edit")}</Link>
            </DropdownMenuItem>
            {card.status === "ACTIVE" && (
              <DropdownMenuItem
                onSelect={() => run(pauseSubscription, "paused")}
              >
                <Pause className="mr-2 h-3.5 w-3.5" />
                {t("pause")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => run(archiveSubscription, "archived")}
            >
              <Archive className="mr-2 h-3.5 w-3.5" />
              {t("archive")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Can>
    </article>
  );
}
