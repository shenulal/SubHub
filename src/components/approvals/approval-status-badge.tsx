// src/components/approvals/approval-status-badge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalRequestStatus, ApprovalStepStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

const REQUEST_STYLES: Record<ApprovalRequestStatus, string> = {
  PENDING: "tonal-warning ring-warning/25",
  INFO_REQUESTED: "tonal-info ring-info/25",
  APPROVED: "tonal-success ring-emerald-500/20",
  REJECTED: "tonal-error ring-error/25",
  CANCELLED: "tonal-neutral ring-border",
};

const STEP_STYLES: Record<ApprovalStepStatus, string> = {
  WAITING: "tonal-neutral ring-border",
  PENDING: REQUEST_STYLES.PENDING,
  APPROVED: REQUEST_STYLES.APPROVED,
  REJECTED: REQUEST_STYLES.REJECTED,
  INFO_REQUESTED: REQUEST_STYLES.INFO_REQUESTED,
  SKIPPED: "tonal-neutral ring-border line-through",
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
        "shrink-0 border-0 font-medium whitespace-nowrap ring-1 ring-inset",
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
        "shrink-0 border-0 font-medium whitespace-nowrap ring-1 ring-inset",
        STEP_STYLES[status],
        className
      )}
    >
      {t(status)}
    </Badge>
  );
}
