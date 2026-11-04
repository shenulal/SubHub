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
import { ApprovalStatusBadge } from "./approval-status-badge";
import { ApprovalStepsList } from "./approval-steps-list";
import { ApprovalTimeline } from "./approval-timeline";
import { formatDate, formatMoney, userLabel } from "./format";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
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
        <ApprovalStatusBadge status={request.status} className="text-sm" />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="border-border rounded-sm shadow-xs">
            <CardContent className="space-y-5 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-sm">
                    {t("requestedBy", {
                      name: userLabel(request.requester, tc("unknownUser")),
                    })}
                    {" · "}
                    {t("submittedOn", {
                      date: formatDate(request.submittedAt),
                    })}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
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
                <p className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                  <TrendingUp className="h-4 w-4" />
                  {t("escalated", { date: formatDate(request.escalatedAt) })}
                </p>
              )}
              <dl className="grid gap-4 sm:grid-cols-3">
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
                        className="text-primary inline-flex items-center gap-1 hover:underline"
                      >
                        {request.vendorWebsite.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-3 w-3" />
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
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
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

          <Card className="border-border rounded-sm shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">{t("timeline")}</CardTitle>
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
          <Card className="border-border rounded-sm shadow-xs lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-base">{t("steps")}</CardTitle>
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
