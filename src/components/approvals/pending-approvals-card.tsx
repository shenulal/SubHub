// src/components/approvals/pending-approvals-card.tsx
"use client";

/**
 * Feature 4.4 — dashboard card: open approvals, committed monthly spend and the
 * five largest open requests. Self-fetching so it can be dropped anywhere.
 */
import { getPendingApprovalsSummary } from "@/actions/approvals/summary";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ApprovalStatusBadge } from "./approval-status-badge";
import { formatMoney, userLabel } from "./format";

export function PendingApprovalsCard({ className }: { className?: string }) {
  const t = useTranslations("approvals.summary");
  const tc = useTranslations("approvals.common");
  const { data, isLoading } = useQuery({
    queryKey: ["approvals", "summary"],
    queryFn: async () => {
      const res = await getPendingApprovalsSummary();
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
    staleTime: 30_000,
  });

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{t("title")}</CardTitle>
            <CardDescription className="line-clamp-2">
              {t("description")}
            </CardDescription>
          </div>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-mr-2 shrink-0 whitespace-nowrap"
        >
          <Link href="/approvals">
            {t("viewAll")}
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted min-w-0 rounded-md p-4">
                <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
                  {t("count")}
                </p>
                <p
                  className="text-foreground mt-1 truncate text-2xl font-medium tabular-nums"
                  title={String(data.count)}
                >
                  {data.count}
                </p>
              </div>
              <div className="bg-muted min-w-0 rounded-md p-4">
                <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
                  {t("committed")}
                </p>
                <p
                  className="text-foreground mt-1 truncate text-2xl font-medium tabular-nums"
                  title={formatMoney(data.committedMonthly, data.currency)}
                >
                  {formatMoney(data.committedMonthly, data.currency)}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {t("committedHint")}
                </p>
              </div>
            </div>
            {data.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  {t("topRequests")}
                </p>
                <ul className="divide-border divide-y">
                  {data.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/approvals/${item.id}`}
                        className="hover:bg-accent -mx-2 flex min-w-0 items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors"
                      >
                        <div className="min-w-0">
                          <p
                            className="text-foreground truncate text-sm font-medium"
                            title={item.serviceName}
                          >
                            {item.serviceName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {userLabel(item.requester, tc("unknownUser"))}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                            {formatMoney(item.monthlyAmount, item.currency)}
                          </span>
                          <ApprovalStatusBadge status={item.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
