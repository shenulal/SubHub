// src/components/approvals/approval-status-badge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalRequestStatus, ApprovalStepStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

const REQUEST_STYLES: Record<ApprovalRequestStatus, string> = {
  PENDING:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  INFO_REQUESTED:
    "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  APPROVED:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  REJECTED:
    "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  CANCELLED: "bg-muted text-muted-foreground ring-border dark:bg-muted/60",
};

const STEP_STYLES: Record<ApprovalStepStatus, string> = {
  WAITING: "bg-muted text-muted-foreground ring-border",
  PENDING: REQUEST_STYLES.PENDING,
  APPROVED: REQUEST_STYLES.APPROVED,
  REJECTED: REQUEST_STYLES.REJECTED,
  INFO_REQUESTED: REQUEST_STYLES.INFO_REQUESTED,
  SKIPPED: "bg-muted text-muted-foreground ring-border line-through",
};

export function ApprovalStatusBadge({
  status,
  className,
}: {
  status: ApprovalRequestStatus;
  className?: string;
}) {
  const t = useTranslations("approvals.status");
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-medium ring-1 ring-inset",
        REQUEST_STYLES[status],
        className
      )}
    >
      {t(status)}
    </Badge>
  );
}

export function ApprovalStepBadge({
  status,
  className,
}: {
  status: ApprovalStepStatus;
  className?: string;
}) {
  const t = useTranslations("approvals.stepStatus");
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-medium ring-1 ring-inset",
        STEP_STYLES[status],
        className
      )}
    >
      {t(status)}
    </Badge>
  );
}
