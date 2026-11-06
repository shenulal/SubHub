// src/components/approvals/approval-decision-summary.tsx
"use client";

/** "Decision" card on the request detail: who decided, when, and what was captured. */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalDecisionSummary } from "@/types/approval";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatDateOnly, formatDateTime, userLabel } from "./format";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-muted-foreground text-[0.8125rem] font-medium">
        {label}
      </dt>
      <dd className="text-foreground min-w-0 text-[0.9375rem] break-words whitespace-pre-wrap">
        {children}
      </dd>
    </div>
  );
}

export function ApprovalDecisionSummaryCard({
  decision,
}: {
  decision: ApprovalDecisionSummary;
}) {
  const t = useTranslations("approvals.decisionSummary");
  const tc = useTranslations("approvals.common");
  const approved = decision.status === "APPROVED";
  const name = userLabel(decision.decidedBy, tc("unknownUser"));
  return (
    <Card data-testid="approval-decision-summary">
      <CardHeader className="flex flex-row items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md",
            approved ? "tonal-success" : "tonal-error"
          )}
        >
          {approved ? <Check className="size-5" /> : <X className="size-5" />}
        </span>
        <div className="min-w-0">
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-muted-foreground truncate text-[0.8125rem]">
            {approved ? t("approvedBy", { name }) : t("rejectedBy", { name })}{" "}
            {t("decidedOn", { date: formatDateTime(decision.decidedAt) })}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3">
          {decision.reason && (
            <Row label={t("reason")}>
              <span className="tonal-error inline-flex rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium">
                {decision.reason.name}
              </span>
            </Row>
          )}
          <Row label={t("comment")}>{decision.comment || t("none")}</Row>
          {approved && (
            <>
              <Row label={t("conditions")}>
                {decision.conditions || t("none")}
              </Row>
              <Row label={t("effectiveStartDate")}>
                {decision.effectiveStartDate
                  ? formatDateOnly(decision.effectiveStartDate)
                  : t("none")}
              </Row>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
