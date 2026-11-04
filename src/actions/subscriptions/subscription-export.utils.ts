// src/actions/subscriptions/subscription-export.utils.ts
/**
 * Pure helpers for the subscription CSV export (no "use server": Next.js only
 * allows async function exports from server-action modules).
 */
import type { prisma } from "@/lib/db";
import { escapeCSVValue, formatDate } from "@/lib/services/export/csv";

import type { SUBSCRIPTION_DETAIL_INCLUDE } from "./subscription-crud-read.mappers";

export const SUBSCRIPTION_EXPORT_COLUMNS = [
  "Vendor",
  "Status",
  "Category",
  "Parent category",
  "Tags",
  "Amount",
  "Currency",
  "Billing cycle",
  "Billing type",
  "Start date",
  "End date",
  "Renewal date",
  "Auto renewal",
  "Trial",
  "Trial ends",
  "Notice period (days)",
  "Cancellation deadline",
  "Owner",
  "Owner email",
  "Cost centre",
  "Payment method",
  "Tax rate",
  "Teams",
  "Assigned users",
  "Personal",
  "Notes",
  "Custom fields",
] as const;

export const MAX_EXPORT_ROWS = 5000;

type ExportRow = Awaited<
  ReturnType<
    typeof prisma.subscription.findMany<{
      include: typeof SUBSCRIPTION_DETAIL_INCLUDE;
    }>
  >
>[number];

function joinNames(values: Array<string | null | undefined>): string {
  return values.filter((v): v is string => Boolean(v)).join("; ");
}

export function subscriptionToCsvRow(row: ExportRow): string[] {
  return [
    row.app.name,
    row.status,
    row.category?.name ?? "",
    row.category?.parent?.name ?? "",
    joinNames(row.tags.map((t) => t.tag.name)),
    String(Number(row.amount)),
    row.currency,
    row.billingCycle,
    row.billingType,
    formatDate(row.startDate),
    formatDate(row.endDate),
    formatDate(row.renewalDate),
    row.autoRenewal ? "yes" : "no",
    row.isTrial ? "yes" : "no",
    formatDate(row.trialEndsAt),
    row.noticePeriodDays == null ? "" : String(row.noticePeriodDays),
    formatDate(row.cancellationDeadline),
    row.owner?.name ?? "",
    row.owner?.email ?? "",
    row.costCenter ? `${row.costCenter.code} ${row.costCenter.name}` : "",
    row.paymentMethod?.name ?? "",
    row.taxRate
      ? `${row.taxRate.name} (${Number(row.taxRate.ratePercent)}%)`
      : "",
    joinNames(row.subscriptionTeams.map((st) => st.team.name)),
    joinNames(row.assignedUsers.map((su) => su.user.name ?? su.user.email)),
    row.isPersonal ? "yes" : "no",
    row.notes ?? "",
    row.customFieldValues
      .map((cfv) => `${cfv.field.label}=${cfv.value}`)
      .join("; "),
  ];
}

export function rowsToCsv(rows: string[][]): string {
  const lines = [
    SUBSCRIPTION_EXPORT_COLUMNS.map(escapeCSVValue).join(","),
    ...rows.map((r) => r.map(escapeCSVValue).join(",")),
  ];
  return `﻿${lines.join("\r\n")}`;
}
