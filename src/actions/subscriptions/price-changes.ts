"use server";

/**
 * Price-change events: list (org / subscription) and acknowledge, optionally
 * applying the detected amount to the subscription.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { priceChangeAckSchema } from "@/lib/validations/subscriptions";
import type { ActionState } from "@/types";
import type { PriceChangeSource } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  isNextNavigationError,
  LIFECYCLE_ERRORS,
  toActionError,
} from "./subscription-lifecycle.helpers";

export interface PriceChangeItem {
  id: string;
  subscriptionId: string;
  appName: string;
  previousAmount: number;
  newAmount: number;
  currency: string;
  changePercent: number;
  source: PriceChangeSource;
  detectedAt: Date;
  acknowledgedAt: Date | null;
}

export interface ListPriceChangesOptions {
  subscriptionId?: string;
  /** Default: only unacknowledged events. */
  includeAcknowledged?: boolean;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

async function _listPriceChanges(
  options: ListPriceChangesOptions = {}
): Promise<ActionState<PriceChangeItem[]>> {
  try {
    const { organizationId } = await requirePermission("subscriptions:read");
    const rows = await prisma.priceChangeEvent.findMany({
      where: {
        organizationId,
        ...(options.subscriptionId
          ? { subscriptionId: options.subscriptionId }
          : {}),
        ...(options.includeAcknowledged ? {} : { acknowledgedAt: null }),
      },
      orderBy: { detectedAt: "desc" },
      take: Math.min(Math.max(1, options.limit ?? DEFAULT_LIMIT), MAX_LIMIT),
      include: {
        subscription: { select: { app: { select: { name: true } } } },
      },
    });
    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        subscriptionId: row.subscriptionId,
        appName: row.subscription.app.name,
        previousAmount: Number(row.previousAmount),
        newAmount: Number(row.newAmount),
        currency: row.currency,
        changePercent: Number(row.changePercent),
        source: row.source,
        detectedAt: row.detectedAt,
        acknowledgedAt: row.acknowledgedAt,
      })),
    };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error }, "listPriceChanges");
    return toActionError(error);
  }
}
export const listPriceChanges = withLogging(
  "listPriceChanges",
  _listPriceChanges
);

async function _acknowledgePriceChange(
  id: string,
  options: { applyNewAmount?: boolean } = {}
): Promise<ActionState<{ id: string; appliedAmount: number | null }>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:update"
    );
    const parsed = priceChangeAckSchema.safeParse(options);
    if (!parsed.success) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidInput };
    }
    const event = await prisma.priceChangeEvent.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        subscriptionId: true,
        newAmount: true,
        previousAmount: true,
        acknowledgedAt: true,
      },
    });
    if (!event) return { success: false, error: LIFECYCLE_ERRORS.notFound };

    const now = new Date();
    await prisma.priceChangeEvent.update({
      where: { id: event.id },
      data: { acknowledgedAt: now, acknowledgedById: userId },
    });

    let appliedAmount: number | null = null;
    if (parsed.data.applyNewAmount) {
      appliedAmount = Number(event.newAmount);
      await prisma.subscription.update({
        where: { id: event.subscriptionId },
        data: { amount: event.newAmount },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "ACKNOWLEDGE_PRICE_CHANGE",
        entityType: "price_change",
        entityId: event.subscriptionId,
        changes: appliedAmount
          ? {
              amount: { from: Number(event.previousAmount), to: appliedAmount },
            }
          : undefined,
        metadata: {
          priceChangeEventId: event.id,
          applied: parsed.data.applyNewAmount,
        },
      },
    });

    revalidatePath(`/subscriptions/${event.subscriptionId}`);
    revalidatePath("/dashboard");
    return { success: true, data: { id: event.id, appliedAmount } };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, id }, "acknowledgePriceChange");
    return toActionError(error);
  }
}
export const acknowledgePriceChange = withLogging(
  "acknowledgePriceChange",
  _acknowledgePriceChange
);
