"use client";

/**
 * Activity timeline: audit-log rows for the subscription, its attachments,
 * notes and price changes, newest first.
 */
import {
  getSubscriptionActivity,
  type SubscriptionActivityItem,
} from "@/actions/subscriptions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { describeAuditAction } from "@/lib/audit/describe-action";
import { cn } from "@/lib/utils";
import {
  Archive,
  Ban,
  FileText,
  History,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatDate } from "./subscription-detail.utils";

interface SubscriptionActivityProps {
  subscriptionId: string;
  /** Bump to reload after a local mutation. */
  refreshToken?: number;
}

const ICON_BY_PREFIX: Array<[string, typeof History, string]> = [
  ["PAUSE", Pause, "text-warning"],
  ["RESUME", Play, "text-success"],
  ["ARCHIVE", Archive, "text-muted-foreground"],
  ["RESTORE", Archive, "text-info"],
  ["CANCEL", Ban, "text-error"],
  ["UPLOAD_ATTACHMENT", FileText, "text-primary"],
  ["DELETE_ATTACHMENT", FileText, "text-error"],
  ["ADD_SUBSCRIPTION_COMMENT", MessageSquareText, "text-muted-foreground"],
  ["DETECT_PRICE_CHANGE", TrendingUp, "text-warning"],
  ["ACKNOWLEDGE_PRICE_CHANGE", TrendingUp, "text-success"],
];

function iconFor(action: string): [typeof History, string] {
  const match = ICON_BY_PREFIX.find(([prefix]) => action.startsWith(prefix));
  return match ? [match[1], match[2]] : [History, "text-muted-foreground"];
}

function statusChange(
  changes: SubscriptionActivityItem["changes"]
): { from: string; to: string } | null {
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    return null;
  const c = changes as Record<string, unknown>;
  if (typeof c.from === "string" && typeof c.to === "string") {
    return { from: c.from, to: c.to };
  }
  return null;
}

export function SubscriptionActivity({
  subscriptionId,
  refreshToken = 0,
}: SubscriptionActivityProps) {
  const t = useTranslations("lifecycle.activity");
  const tStatus = useTranslations("lifecycle.status");
  const [items, setItems] = useState<SubscriptionActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void getSubscriptionActivity(subscriptionId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) setItems(result.data);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [subscriptionId, refreshToken]);

  const label = (action: string) =>
    t.has(`actions.${action}`)
      ? t(`actions.${action}`)
      : describeAuditAction(action);
  const statusLabel = (value: string) =>
    tStatus.has(value) ? tStatus(value) : value;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="text-muted-foreground h-4 w-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ol className="relative space-y-0 border-l pl-6">
            {items.map((item) => {
              const [Icon, tone] = iconFor(item.action);
              const change = statusChange(item.changes);
              return (
                <li key={item.id} className="relative pb-5 last:pb-0">
                  <span
                    className={cn(
                      "bg-background absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border",
                      tone
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium">{label(item.action)}</p>
                    <time
                      className="text-muted-foreground text-xs tabular-nums"
                      dateTime={new Date(item.createdAt).toISOString()}
                    >
                      {formatDate(item.createdAt)}
                    </time>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {item.actor
                      ? t("by", { name: item.actor.name ?? item.actor.email })
                      : t("system")}
                    {change && (
                      <>
                        {" · "}
                        {t("statusChange", {
                          from: statusLabel(change.from),
                          to: statusLabel(change.to),
                        })}
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
