// src/components/approvals/approval-detail-client.tsx
"use client";

/**
 * Feature 2.5 — request detail: summary, approval chain, timeline, discussion.
 */
import { addComment } from "@/actions/approvals/decisions";
import { getApprovalRequest } from "@/actions/approvals/requests-read";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalRequestDetail } from "@/types/approval";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, MessageSquare, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ApprovalActions } from "./approval-actions";
import { ApprovalDecisionSummaryCard } from "./approval-decision-summary";
import { ApprovalStatusBadge } from "./approval-status-badge";
import { ApprovalStepsList } from "./approval-steps-list";
import { ApprovalTimeline } from "./approval-timeline";
import { formatDate, formatMoney, userLabel } from "./format";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-muted/60 min-w-0 rounded-md px-4 py-3">
      <dt className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className="text-foreground mt-1 truncate text-[0.9375rem]"
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export function ApprovalDetailClient({
  initial,
}: {
  initial: ApprovalRequestDetail;
}) {
  const t = useTranslations("approvals.detail");
  const tc = useTranslations("approvals.common");
  const tCycle = useTranslations("approvals.cycle");
  const tRoot = useTranslations("approvals");
  const [comment, setComment] = useState("");
  const [isCommenting, startComment] = useTransition();

  const { data, refetch } = useQuery({
    queryKey: ["approvals", "detail", initial.id],
    queryFn: async () => {
      const res = await getApprovalRequest(initial.id);
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
    initialData: initial,
  });
  const request = data ?? initial;

  const submitComment = () => {
    if (!comment.trim()) return;
    startComment(async () => {
      const res = await addComment(request.id, comment.trim());
      if (!res.success) {
        toast.error(res.error ?? tc("errorGeneric"));
        return;
      }
      setComment("");
      await refetch();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={request.serviceName} backHref="/approvals" showBack>
        <ApprovalStatusBadge status={request.status} className="px-3 text-sm" />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-muted-foreground text-sm">
                    {t("requestedBy", {
                      name: userLabel(request.requester, tc("unknownUser")),
                    })}
                    {" · "}
                    {t("submittedOn", {
                      date: formatDate(request.submittedAt),
                    })}
                  </p>
                  <p className="text-foreground mt-1 truncate text-3xl font-medium tabular-nums">
                    {formatMoney(request.monthlyAmount, request.currency)}
                    <span className="text-muted-foreground ml-1 text-base font-normal">
                      {tRoot("perMonth")}
                    </span>
                  </p>
                </div>
                <ApprovalActions
                  request={request}
                  onChanged={() => refetch()}
                />
              </div>
              {request.escalatedAt && (
                <p className="tonal-warning flex items-center gap-2 rounded-md px-4 py-2.5 text-sm">
                  <TrendingUp className="size-4 shrink-0" />
                  {t("escalated", { date: formatDate(request.escalatedAt) })}
                </p>
              )}
              <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Fact
                  label={t("amount")}
                  value={`${formatMoney(request.amount, request.currency)} · ${tCycle(request.billingCycle)}`}
                />
                <Fact label={t("seats")} value={request.seats ?? "—"} />
                <Fact
                  label={t("category")}
                  value={request.category?.name ?? "—"}
                />
                <Fact
                  label={t("costCenter")}
                  value={
                    request.costCenter
                      ? `${request.costCenter.code} · ${request.costCenter.name}`
                      : "—"
                  }
                />
                <Fact
                  label={t("vendor")}
                  value={
                    request.vendorWebsite ? (
                      <a
                        href={request.vendorWebsite}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex max-w-full min-w-0 items-center gap-1 hover:underline"
                      >
                        {request.vendorWebsite.replace(/^https?:\/\//, "")}
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Fact
                  label={t("policy")}
                  value={request.policy?.name ?? t("noPolicy")}
                />
              </dl>
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("justification")}
                </p>
                <p className="text-foreground mt-1.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
                  {request.justification}
                </p>
              </div>
              {request.subscriptionId && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/subscriptions/${request.subscriptionId}`}>
                    {t("viewSubscription")}
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          {request.decision && (
            <ApprovalDecisionSummaryCard decision={request.decision} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t("timeline")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ApprovalTimeline events={request.events} />
              {request.viewer.canComment && (
                <div className="border-border space-y-2 border-t pt-4">
                  <Textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("commentPlaceholder")}
                    aria-label={t("comments")}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={submitComment}
                      disabled={isCommenting || !comment.trim()}
                    >
                      {isCommenting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MessageSquare className="mr-2 h-4 w-4" />
                      )}
                      {t("addComment")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle>{t("steps")}</CardTitle>
            </CardHeader>
            <CardContent>
              {request.steps.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("noPolicy")}</p>
              ) : (
                <ApprovalStepsList
                  steps={request.steps}
                  currentStep={request.currentStep}
                />
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
