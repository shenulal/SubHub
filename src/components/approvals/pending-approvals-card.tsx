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
    <Card className={cn("border-border rounded-sm shadow-xs", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="text-primary h-4 w-4" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="-mr-2">
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
              <div className="bg-muted/40 rounded-md p-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("count")}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {data.count}
                </p>
              </div>
              <div className="bg-muted/40 rounded-md p-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {t("committed")}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatMoney(data.committedMonthly, data.currency)}
                </p>
                <p className="text-muted-foreground text-xs">
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
                        className="hover:bg-muted/50 -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {item.serviceName}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {userLabel(item.requester, tc("unknownUser"))}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-medium tabular-nums">
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
