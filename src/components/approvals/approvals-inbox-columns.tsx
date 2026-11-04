// src/components/approvals/approvals-inbox-columns.tsx
"use client";

import type { DataTableColumn } from "@/components/common/data-table";
import type { ApprovalRequestListItem } from "@/types/approval";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";
import { ApprovalStatusBadge } from "./approval-status-badge";
import { formatMoney, formatRelative, userLabel } from "./format";

export function useInboxColumns(): DataTableColumn<ApprovalRequestListItem>[] {
  const t = useTranslations("approvals.inbox");
  const tc = useTranslations("approvals.common");
  const tCycle = useTranslations("approvals.cycle");
  const perMonth = useTranslations("approvals")("perMonth");

  return useMemo(
    () => [
      {
        id: "serviceName",
        header: t("columns.service"),
        sortable: true,
        cell: (row) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/approvals/${row.id}`}
                className="truncate font-medium hover:underline"
              >
                {row.serviceName}
              </Link>
              {row.isAwaitingMe && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
                  {t("awaitingYou")}
                </span>
              )}
            </div>
            {row.category && (
              <p className="text-muted-foreground truncate text-xs">
                {row.category.name}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "requester",
        header: t("columns.requester"),
        cell: (row) => (
          <span className="text-sm">
            {userLabel(row.requester, tc("unknownUser"))}
          </span>
        ),
      },
      {
        id: "monthlyAmount",
        header: t("columns.monthly"),
        sortable: true,
        className: "text-right",
        headerClassName: "text-right",
        cell: (row) => (
          <div className="text-right">
            <p className="font-medium tabular-nums">
              {formatMoney(row.monthlyAmount, row.currency)}
              <span className="text-muted-foreground ml-1 text-xs">
                {perMonth}
              </span>
            </p>
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatMoney(row.amount, row.currency)} ·{" "}
              {tCycle(row.billingCycle)}
            </p>
          </div>
        ),
      },
      {
        id: "status",
        header: t("columns.status"),
        sortable: true,
        cell: (row) => <ApprovalStatusBadge status={row.status} />,
      },
      {
        id: "step",
        header: t("columns.step"),
        cell: (row) =>
          row.status === "PENDING" || row.status === "INFO_REQUESTED" ? (
            <div className="text-sm">
              <p className="tabular-nums">
                {t("stepOf", {
                  current: row.currentStep,
                  total: row.totalSteps,
                })}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {userLabel(row.currentApprover, tc("unknownUser"))}
              </p>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          ),
      },
      {
        id: "submittedAt",
        header: t("columns.submitted"),
        sortable: true,
        cell: (row) => (
          <span className="text-muted-foreground text-sm">
            {formatRelative(row.submittedAt)}
          </span>
        ),
      },
    ],
    [t, tc, tCycle, perMonth]
  );
}
