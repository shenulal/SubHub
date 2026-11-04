// src/actions/discovery/export.ts
"use server";

/**
 * CSV exports (4.5): the current subscription view and the dashboard category
 * breakdown. Every export is permission-checked, row-capped and audit-logged.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  AUDIT_EXPORT_CATEGORY_SPEND,
  AUDIT_EXPORT_SUBSCRIPTIONS,
} from "@/lib/services/discovery/audit-actions";
import { createBaseConverter } from "@/lib/services/discovery/base-currency";
import {
  flattenCategorySpend,
  getCategorySpendBreakdown,
  type CategoryRow,
} from "@/lib/services/discovery/category-spend";
import { listRowSelect, toListItem } from "@/lib/services/discovery/list-rows";
import {
  filterToWhere,
  sortToOrderBy,
} from "@/lib/services/discovery/list-where";
import { roundMoney } from "@/lib/services/discovery/money";
import { discoveryWhere } from "@/lib/services/discovery/scope-where";
import { formatDate, generateCSV } from "@/lib/services/export/csv";
import { getSetting } from "@/lib/settings/service";
import {
  categorySpendQuerySchema,
  subscriptionFilterSchema,
  subscriptionSortSchema,
} from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type { SubscriptionListItem } from "@/types/subscription";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { getWorkspaceScope } from "./scope";

export interface CsvExport {
  filename: string;
  csv: string;
  rowCount: number;
}

const MAX_EXPLICIT_IDS = 5000;

const exportInputSchema = z.object({
  filter: subscriptionFilterSchema.default({}),
  sort: subscriptionSortSchema.optional(),
  /** Explicit selection (bulk bar "export selected"); intersected with the filter. */
  ids: z.array(z.string().min(1)).max(MAX_EXPLICIT_IDS).optional(),
});

function datedFilename(prefix: string, now = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.csv`;
}

async function auditExport(
  action: string,
  userId: string,
  organizationId: string,
  metadata: Prisma.InputJsonValue
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action,
      entityType: "Subscription",
      userId,
      organizationId,
      metadata,
    },
  });
}

type ExportRow = SubscriptionListItem & { monthlyBase: number };

function subscriptionColumns(baseCurrency: string) {
  return [
    { key: "appName", header: "App" },
    {
      key: "category",
      header: "Category",
      formatter: (_: unknown, row: ExportRow) =>
        row.category
          ? [row.category.parentName, row.category.name]
              .filter(Boolean)
              .join(" / ")
          : "",
    },
    {
      key: "tags",
      header: "Tags",
      formatter: (_: unknown, row: ExportRow) =>
        row.tags.map((t) => t.name).join("; "),
    },
    {
      key: "owner",
      header: "Owner",
      formatter: (_: unknown, row: ExportRow) =>
        row.owner?.name ?? row.owner?.email ?? "",
    },
    { key: "teamName", header: "Team" },
    {
      key: "costCenter",
      header: "Cost centre",
      formatter: (_: unknown, row: ExportRow) => row.costCenter?.code ?? "",
    },
    {
      key: "paymentMethod",
      header: "Payment method",
      formatter: (_: unknown, row: ExportRow) => row.paymentMethod?.name ?? "",
    },
    { key: "status", header: "Status" },
    { key: "billingCycle", header: "Billing cycle" },
    { key: "amount", header: "Amount" },
    { key: "currency", header: "Currency" },
    {
      key: "monthlyBase",
      header: `Monthly (${baseCurrency})`,
      formatter: (v: unknown) => String(roundMoney(Number(v))),
    },
    {
      key: "renewalDate",
      header: "Next renewal",
      formatter: (v: unknown) => formatDate(v as Date | null),
    },
    {
      key: "trialEndsAt",
      header: "Trial ends",
      formatter: (v: unknown) => formatDate(v as Date | null),
    },
    {
      key: "cancellationDeadline",
      header: "Cancellation deadline",
      formatter: (v: unknown) => formatDate(v as Date | null),
    },
    { key: "totalLicenses", header: "Licenses" },
    { key: "usedLicenses", header: "Used licenses" },
    { key: "isPersonal", header: "Personal" },
  ];
}

/** Export the current filtered view (list page "Export" button). */
export const exportSubscriptionsCsv = withLogging(
  "exportSubscriptionsCsv",
  async (input: unknown): Promise<ActionState<CsvExport>> => {
    const parsed = exportInputSchema.safeParse(input ?? {});
    if (!parsed.success) return { success: false, error: "Invalid filter" };
    const { filter, sort, ids } = parsed.data;
    try {
      const { organizationId, userId, permissions } = await requirePermission(
        "subscriptions:export"
      );
      const [maxRows, scopeState, viewer, converter] = await Promise.all([
        getSetting(organizationId, "discovery.exportMaxRows"),
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
        createBaseConverter(organizationId),
      ]);
      const scope = filter.scope ?? scopeState.scope;
      const where = discoveryWhere(
        organizationId,
        scope,
        {
          userId,
          teamId: viewer?.teamId ?? null,
          canReadAll: permissions.has("subscriptions:read_all"),
        },
        {
          ...filterToWhere(filter),
          ...(ids?.length && { id: { in: ids } }),
        }
      );
      const rows = await prisma.subscription.findMany({
        where,
        select: listRowSelect,
        orderBy: sortToOrderBy(sort ?? { sortBy: "appName", sortOrder: "asc" }),
        take: maxRows + 1,
      });
      if (rows.length > maxRows) {
        return {
          success: false,
          error: `Export exceeds the ${maxRows}-row limit; narrow the filter`,
        };
      }
      const data: ExportRow[] = await Promise.all(
        rows.map(async (row) => {
          const monthlyBase = await converter.monthlyBase(
            Number(row.amount),
            row.currency,
            row.billingCycle
          );
          return { ...toListItem(row, monthlyBase), monthlyBase };
        })
      );
      const csv = generateCSV<ExportRow>(
        subscriptionColumns(converter.baseCurrency),
        data,
        { includeBOM: true }
      );
      await auditExport(AUDIT_EXPORT_SUBSCRIPTIONS, userId, organizationId, {
        filter: { ...filter, scope } as Prisma.InputJsonValue,
        explicitIds: ids?.length ?? 0,
        rowCount: data.length,
      });
      return {
        success: true,
        data: {
          filename: datedFilename("subscriptions"),
          csv,
          rowCount: data.length,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] exportSubscriptionsCsv failed");
      return { success: false, error: "Export failed" };
    }
  }
);

/** Dashboard "Spend by category" CSV. */
export const exportCategorySpendCsv = withLogging(
  "exportCategorySpendCsv",
  async (input: unknown = {}): Promise<ActionState<CsvExport>> => {
    const parsed = categorySpendQuerySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid filter" };
    try {
      const { organizationId, userId, permissions } =
        await requirePermission("reports:export");
      const [scopeState, viewer, converter] = await Promise.all([
        getWorkspaceScope(),
        prisma.user.findUnique({
          where: { id: userId },
          select: { teamId: true },
        }),
        createBaseConverter(organizationId),
      ]);
      const slices = await getCategorySpendBreakdown({
        organizationId,
        scope: parsed.data.scope ?? scopeState.scope,
        viewer: {
          userId,
          teamId: viewer?.teamId ?? null,
          canReadAll: permissions.has("subscriptions:read_all"),
        },
        ownerId: parsed.data.ownerId,
        teamId: parsed.data.teamId,
        converter,
      });
      const rows = flattenCategorySpend(slices);
      const csv = generateCSV<CategoryRow>(
        [
          { key: "parent", header: "Category" },
          { key: "category", header: "Subcategory" },
          { key: "monthlyBase", header: `Monthly (${converter.baseCurrency})` },
          { key: "annualBase", header: `Annual (${converter.baseCurrency})` },
          { key: "count", header: "Subscriptions" },
        ],
        rows,
        { includeBOM: true }
      );
      await auditExport(AUDIT_EXPORT_CATEGORY_SPEND, userId, organizationId, {
        filter: parsed.data as Prisma.InputJsonValue,
        rowCount: rows.length,
      });
      return {
        success: true,
        data: {
          filename: datedFilename("spend-by-category"),
          csv,
          rowCount: rows.length,
        },
      };
    } catch (error) {
      if (isForbiddenError(error)) {
        return { success: false, error: error.message };
      }
      logger.error({ err: error }, "[discovery] exportCategorySpendCsv failed");
      return { success: false, error: "Export failed" };
    }
  }
);
