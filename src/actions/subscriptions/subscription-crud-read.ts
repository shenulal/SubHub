// src/actions/subscriptions/subscription-crud-read.ts
"use server";

/**
 * Subscription 조회 관련 Server Actions
 */

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getUserPermissionSet } from "@/lib/rbac/service";
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

async function resolveVisibility(
  needsReadAll: boolean
): Promise<ListVisibilityContext> {
  const { organizationId, role, userId, teamId } = await requireOrganization();
  let canReadAll = role === "ADMIN";
  if (!canReadAll && needsReadAll) {
    const permissions = await getUserPermissionSet(userId, organizationId);
    canReadAll = permissions.has("subscriptions:read_all");
  }
  return { organizationId, userId, role, teamId, canReadAll };
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
 * 구독 목록 조회
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
  const ctx = await resolveVisibility(filter.scope === "all");

  // Legacy: a MEMBER without a team sees nothing.
  if (ctx.role === "MEMBER" && !ctx.teamId && !ctx.canReadAll) {
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
 * 구독 상세 조회
 */
export async function getSubscription(
  id: string
): Promise<SubscriptionDetail | null> {
  const { organizationId, role, userId } = await requireOrganization();

  // Non-admins see subscriptions they own, are assigned to, or that are
  // workspace-visible; personal items stay private to their owner.
  const visibility =
    role === "ADMIN"
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

// 동일 요청 내에서 구독 상세를 중복 호출할 때 캐시로 DB 조회를 한 번만 수행
export const getSubscriptionCached = cache(getSubscription);

/**
 * 구독에 연결된 결제 내역 조회
 */
export async function getLinkedPayments(
  subscriptionId: string
): Promise<ActionState<LinkedPayment[]>> {
  try {
    const { organizationId } = await requireOrganization();

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: { id: true },
    });

    if (!subscription) {
      return { success: false, message: "구독을 찾을 수 없습니다" };
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
    return { success: false, message: "연결된 결제 내역 조회에 실패했습니다" };
  }
}
