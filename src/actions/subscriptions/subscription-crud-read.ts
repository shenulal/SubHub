// src/actions/subscriptions/subscription-crud-read.ts
"use server";

/**
 * Subscription read Server Actions
 */

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { can, getUserPermissionSet } from "@/lib/rbac/service";
import { toMonthlyBaseAmount } from "@/lib/services/subscription/money-adapter";
import type { ActionState, PaginatedResponse } from "@/types";
import type {
  SubscriptionDetail,
  SubscriptionListItem,
} from "@/types/subscription";
import { cache } from "react";

import {
  mapSubscriptionDetail,
  mapSubscriptionListItem,
  SUBSCRIPTION_DETAIL_INCLUDE,
  SUBSCRIPTION_LIST_INCLUDE,
} from "./subscription-crud-read.mappers";
import {
  buildSubscriptionOrderBy,
  buildSubscriptionWhere,
  type ListVisibilityContext,
} from "./subscription-crud-read.where";
import type {
  GetSubscriptionsParams,
  LinkedPayment,
} from "./subscription-crud.types";

const DEFAULT_PAGE_SIZE = 20;

async function resolveVisibility(): Promise<
  ListVisibilityContext & { canRead: boolean }
> {
  const { organizationId, role, userId, teamId } = await requireOrganization();
  const permissions = await getUserPermissionSet(userId, organizationId);
  return {
    organizationId,
    userId,
    role,
    teamId,
    canRead: permissions.has("subscriptions:read"),
    canReadAll: permissions.has("subscriptions:read_all"),
  };
}

/** Attach the monthly base-currency amount when FX is available. */
async function withMonthlyBase(
  organizationId: string,
  items: SubscriptionListItem[]
): Promise<SubscriptionListItem[]> {
  const amounts = await Promise.all(
    items.map((item) =>
      toMonthlyBaseAmount(organizationId, {
        amount: item.amount,
        currency: item.currency,
        billingCycle: item.billingCycle,
      })
    )
  );
  return items.map((item, index) =>
    amounts[index] == null
      ? item
      : { ...item, monthlyAmountBase: amounts[index] }
  );
}

/**
 * List subscriptions
 */
export async function getSubscriptions(
  params: GetSubscriptionsParams = {}
): Promise<PaginatedResponse<SubscriptionListItem>> {
  const {
    filter = {},
    sort = { sortBy: "renewalDate", sortOrder: "asc" },
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
  } = params;
  const ctx = await resolveVisibility();

  // No subscriptions:read, or team-scoped without a team: nothing to list.
  const teamScopedWithoutTeam =
    !ctx.canReadAll && ctx.role !== "VIEWER" && !ctx.teamId;
  if (!ctx.canRead || teamScopedWithoutTeam) {
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }

  const where = buildSubscriptionWhere(filter, ctx);
  const orderBy = buildSubscriptionOrderBy(sort);
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: SUBSCRIPTION_LIST_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  const items = await withMonthlyBase(
    ctx.organizationId,
    rows.map((row) => mapSubscriptionListItem(row))
  );

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get subscription details
 */
export async function getSubscription(
  id: string
): Promise<SubscriptionDetail | null> {
  const { organizationId, userId, canRead, canReadAll } =
    await resolveVisibility();
  if (!canRead) return null;

  // Without subscriptions:read_all a user sees subscriptions they own, are
  // assigned to, or that are workspace-visible; personal items stay private.
  const visibility = canReadAll
    ? {}
    : {
        OR: [
          { ownerId: userId },
          { assignedUsers: { some: { userId } } },
          { isPersonal: false },
        ],
        NOT: { isPersonal: true, ownerId: { not: userId } },
      };

  const subscription = await prisma.subscription.findFirst({
    where: { id, organizationId, ...visibility },
    include: SUBSCRIPTION_DETAIL_INCLUDE,
  });

  if (!subscription) return null;
  return mapSubscriptionDetail(subscription);
}

// Cache so repeated subscription-detail calls within one request hit the DB only once
export const getSubscriptionCached = cache(getSubscription);

/**
 * Get payment records linked to a subscription
 */
export async function getLinkedPayments(
  subscriptionId: string
): Promise<ActionState<LinkedPayment[]>> {
  try {
    const { organizationId } = await requireOrganization();
    // Payment records are organisation finance data (payments:read).
    if (!(await can("payments:read"))) return { success: true, data: [] };

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: { id: true },
    });

    if (!subscription) {
      return { success: false, message: "Subscription not found" };
    }

    const payments = await prisma.paymentRecord.findMany({
      where: { linkedSubscriptionId: subscriptionId, organizationId },
      select: {
        id: true,
        transactionDate: true,
        merchantName: true,
        amount: true,
        currency: true,
        cardLast4: true,
      },
      orderBy: { transactionDate: "desc" },
    });

    return {
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        transactionDate: p.transactionDate,
        merchantName: p.merchantName,
        amount: Number(p.amount),
        currency: p.currency,
        cardLast4: p.cardLast4,
      })),
    };
  } catch (error) {
    logger.error({ err: error }, "getLinkedPayments error");
    return { success: false, message: "Failed to load linked payment records" };
  }
}
