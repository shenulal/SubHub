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

/** Lane accent colours — light + dark safe. */
export const LANE_STYLES: Record<
  PipelineLaneKey,
  { bar: string; chip: string; text: string }
> = {
  overdue: {
    bar: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    text: "text-rose-600 dark:text-rose-400",
  },
  week: {
    bar: "bg-amber-500",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    text: "text-amber-600 dark:text-amber-400",
  },
  month: {
    bar: "bg-primary",
    chip: "bg-primary/10 text-primary",
    text: "text-primary",
  },
  later: {
    bar: "bg-muted-foreground/50",
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
  trialEnding: {
    bar: "bg-violet-500",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-400",
  },
  noticeDeadline: {
    bar: "bg-orange-500",
    chip: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
    text: "text-orange-600 dark:text-orange-400",
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
        "bg-card group relative flex gap-3 rounded-lg border p-3 shadow-xs transition-shadow hover:shadow-md",
        compact && "items-center py-2"
      )}
    >
      <span
        className={cn(
          "absolute top-3 bottom-3 left-0 w-0.5 rounded-r",
          style.bar
        )}
      />
      {card.appLogoUrl ? (
        <Image
          src={card.appLogoUrl}
          alt={card.appName}
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 rounded-md border object-contain"
        />
      ) : (
        <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold">
          {card.appName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/subscriptions/${card.id}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {card.appName}
          </Link>
          <span
            className={cn(
              "shrink-0 text-xs font-semibold tabular-nums",
              style.text
            )}
          >
            {daysLabel}
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium tabular-nums">
            {formatMoney(card.amount, card.currency, locale)}
          </span>
          {card.currency !== baseCurrency && (
            <span className="text-muted-foreground tabular-nums">
              ≈ {formatMoney(card.monthlyBase, baseCurrency, locale)}{" "}
              {t("perMonth")}
            </span>
          )}
          <span className="text-muted-foreground">
            {format(new Date(card.dueDate), "MMM d")}
          </span>
          {card.isTrial && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 text-[10px]",
                LANE_STYLES.trialEnding.chip
              )}
            >
              <FlaskConical className="h-3 w-3" />
              {t("trial")}
            </span>
          )}
        </div>
        {!compact && (card.owner || card.teamName) && (
          <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
            <User className="h-3 w-3" />
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
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
