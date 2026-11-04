"use server";

/**
 * Subscription notes (comments) and the merged activity timeline.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { commentBodySchema } from "@/lib/validations/subscriptions";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  isNextNavigationError,
  LIFECYCLE_ERRORS,
  toActionError,
} from "./subscription-lifecycle.helpers";

export interface SubscriptionCommentItem {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string | null; email: string } | null;
}

export interface SubscriptionActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
}

/** Audit entity types that belong to a subscription's timeline. */
const ACTIVITY_ENTITY_TYPES = [
  "subscription",
  "Subscription",
  "attachment",
  "subscription_comment",
  "price_change",
] as const;

const DEFAULT_ACTIVITY_LIMIT = 100;
const DEFAULT_COMMENT_LIMIT = 200;

async function assertSubscriptionInOrg(
  id: string,
  organizationId: string
): Promise<boolean> {
  const row = await prisma.subscription.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  return Boolean(row);
}

async function _listSubscriptionComments(
  subscriptionId: string
): Promise<ActionState<SubscriptionCommentItem[]>> {
  try {
    const { organizationId } = await requirePermission("subscriptions:read");
    if (!(await assertSubscriptionInOrg(subscriptionId, organizationId))) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    const rows = await prisma.subscriptionComment.findMany({
      where: { subscriptionId, organizationId },
      orderBy: { createdAt: "desc" },
      take: DEFAULT_COMMENT_LIMIT,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });
    return { success: true, data: rows };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, subscriptionId }, "listSubscriptionComments");
    return toActionError(error);
  }
}
export const listSubscriptionComments = withLogging(
  "listSubscriptionComments",
  _listSubscriptionComments
);

async function _addSubscriptionComment(
  subscriptionId: string,
  body: string
): Promise<ActionState<SubscriptionCommentItem>> {
  try {
    const { organizationId, userId } =
      await requirePermission("comments:create");
    const parsed = commentBodySchema.safeParse({ body });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? LIFECYCLE_ERRORS.invalidInput,
      };
    }
    if (!(await assertSubscriptionInOrg(subscriptionId, organizationId))) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    const comment = await prisma.subscriptionComment.create({
      data: {
        organizationId,
        subscriptionId,
        authorId: userId,
        body: parsed.data.body,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "ADD_SUBSCRIPTION_COMMENT",
        entityType: "subscription_comment",
        entityId: subscriptionId,
        metadata: { commentId: comment.id },
      },
    });
    revalidatePath(`/subscriptions/${subscriptionId}`);
    return { success: true, data: comment };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, subscriptionId }, "addSubscriptionComment");
    return toActionError(error);
  }
}
export const addSubscriptionComment = withLogging(
  "addSubscriptionComment",
  _addSubscriptionComment
);

async function _getSubscriptionActivity(
  subscriptionId: string,
  limit: number = DEFAULT_ACTIVITY_LIMIT
): Promise<ActionState<SubscriptionActivityItem[]>> {
  try {
    const { organizationId } = await requirePermission("subscriptions:read");
    if (!(await assertSubscriptionInOrg(subscriptionId, organizationId))) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: subscriptionId,
        entityType: { in: [...ACTIVITY_ENTITY_TYPES] },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(1, limit), DEFAULT_ACTIVITY_LIMIT * 5),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return {
      success: true,
      data: rows.map(({ user, ...row }) => ({ ...row, actor: user })),
    };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, subscriptionId }, "getSubscriptionActivity");
    return toActionError(error);
  }
}
export const getSubscriptionActivity = withLogging(
  "getSubscriptionActivity",
  _getSubscriptionActivity
);
