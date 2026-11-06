"use server";

/**
 * CSV export of the subscription list (all list fields + category path, tags,
 * custom fields, owner and cost centre). Permission: `subscriptions:export`.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { getUserPermissionSet, requirePermission } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { SubscriptionFilterOptions } from "@/types/subscription";

import { formatDate } from "@/lib/services/export/csv";
import { SUBSCRIPTION_DETAIL_INCLUDE } from "./subscription-crud-read.mappers";
import { buildSubscriptionWhere } from "./subscription-crud-read.where";
import {
  MAX_EXPORT_ROWS,
  rowsToCsv,
  subscriptionToCsvRow,
} from "./subscription-export.utils";
import {
  isNextNavigationError,
  toActionError,
} from "./subscription-lifecycle.helpers";

export interface ExportResult {
  csv: string;
  fileName: string;
  rowCount: number;
}

async function _exportSubscriptions(
  filter: SubscriptionFilterOptions = {}
): Promise<ActionState<ExportResult>> {
  try {
    const { organizationId, userId, role } = await requirePermission(
      "subscriptions:export"
    );
    const permissions = await getUserPermissionSet(userId, organizationId);
    const where = buildSubscriptionWhere(filter, {
      organizationId,
      userId,
      role,
      teamId: null,
      canReadAll: permissions.has("subscriptions:read_all"),
    });
    const rows = await prisma.subscription.findMany({
      where,
      include: SUBSCRIPTION_DETAIL_INCLUDE,
      orderBy: { app: { name: "asc" } },
      take: MAX_EXPORT_ROWS,
    });
    const csv = rowsToCsv(rows.map(subscriptionToCsvRow));

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "EXPORT_SUBSCRIPTIONS",
        entityType: "subscription",
        metadata: { rowCount: rows.length, filter: JSON.stringify(filter) },
      },
    });

    return {
      success: true,
      data: {
        csv,
        fileName: `subscriptions-${formatDate(new Date())}.csv`,
        rowCount: rows.length,
      },
    };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error }, "exportSubscriptions");
    return toActionError(error);
  }
}
export const exportSubscriptions = withLogging(
  "exportSubscriptions",
  _exportSubscriptions
);
