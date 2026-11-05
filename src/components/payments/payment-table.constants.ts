// src/components/payments/payment-table.constants.ts
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import type { PaymentMatchStatus } from "@prisma/client";
import { useTranslations } from "next-intl";

export function getStatusLabels(
  t: ReturnType<typeof useTranslations>
): Record<PaymentMatchStatus, string> {
  return {
    PENDING: t("payments.status.pending"),
    AUTO_MATCHED: t("payments.status.autoMatched"),
    MANUAL: t("payments.status.manual"),
    UNMATCHED: t("payments.status.unmatched"),
  };
}

export const STATUS_COLORS: Record<PaymentMatchStatus, string> = {
  PENDING: "tonal-warning",
  AUTO_MATCHED: "tonal-info",
  MANUAL: "tonal-primary",
  UNMATCHED: "tonal-neutral",
};

// Column definitions for the column-visibility dropdown (exported)
export function getPaymentRecordColumns(t: ReturnType<typeof useTranslations>) {
  return [
    { id: "source", header: t("payments.table.columns.source") },
    {
      id: "transactionDate",
      header: t("payments.table.columns.transactionDate"),
    },
    { id: "merchantName", header: t("payments.table.columns.merchantName") },
    { id: "amount", header: t("payments.table.columns.amount") },
    { id: "matchStatus", header: t("payments.table.columns.matchStatus") },
    { id: "matchedApp", header: t("payments.table.columns.matchedApp") },
    {
      id: "linkedSubscription",
      header: t("payments.table.columns.linkedSubscription"),
    },
  ];
}

export function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: currency || DEFAULT_BASE_CURRENCY,
  }).format(amount);
}

export function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
