// src/components/approvals/approval-steps-list.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ApprovalStepView } from "@/types/approval";
import { Check, Clock, HelpCircle, MinusCircle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { ApprovalStepBadge } from "./approval-status-badge";
import { formatDate, userLabel } from "./format";

const ICONS = {
  WAITING: Clock,
  PENDING: Clock,
  APPROVED: Check,
  REJECTED: X,
  INFO_REQUESTED: HelpCircle,
  SKIPPED: MinusCircle,
} as const;

const RING = {
  WAITING: "border-border text-muted-foreground",
  PENDING: "border-amber-400 text-amber-600 dark:text-amber-300",
  APPROVED: "border-emerald-500 bg-emerald-500 text-white",
  REJECTED: "border-rose-500 bg-rose-500 text-white",
  INFO_REQUESTED: "border-sky-400 text-sky-600 dark:text-sky-300",
  SKIPPED: "border-border text-muted-foreground",
} as const;

export function ApprovalStepsList({
  steps,
  currentStep,
}: {
  steps: ApprovalStepView[];
  currentStep: number;
}) {
  const t = useTranslations("approvals.detail");
  const tc = useTranslations("approvals.common");

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const Icon = ICONS[step.status];
        const isCurrent =
          step.stepOrder === currentStep && step.status === "PENDING";
        const others = step.candidates.filter((c) => c.id !== step.approver.id);
        return (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className="bg-border absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px"
              />
            )}
            <span
              className={cn(
                "bg-background z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                RING[step.status],
                isCurrent && "ring-4 ring-amber-400/20"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground mr-2 tabular-nums">
                    {step.stepOrder}.
                  </span>
                  {step.label}
                </p>
                <ApprovalStepBadge status={step.status} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {userLabel(step.approver, tc("unknownUser"))}
                {others.length > 0 && (
                  <span className="ml-1 text-xs">
                    ·{" "}
                    {t("candidates", {
                      names: others
                        .map((u) => userLabel(u, tc("unknownUser")))
                        .join(", "),
                    })}
                  </span>
                )}
              </p>
              {step.comment && (
                <p className="bg-muted/50 mt-2 rounded-md px-3 py-2 text-sm">
                  {step.comment}
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {step.decidedAt
                  ? t("decidedAt", { date: formatDate(step.decidedAt) })
                  : isCurrent && step.dueAt
                    ? t("dueBy", { date: formatDate(step.dueAt) })
                    : null}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
