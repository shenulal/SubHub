"use server";

/**
 * Per-subscription cancellation override (link + notes). The vendor-level
 * override lives on App and is managed by the taxonomy area.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  isNextNavigationError,
  LIFECYCLE_ERRORS,
  toActionError,
} from "./subscription-lifecycle.helpers";

const MAX_NOTES = 2000;

const subscriptionCancellationOverrideSchema = z.object({
  cancellationUrl: z
    .string()
    .trim()
    .url()
    .max(1000)
    .nullable()
    .optional()
    .or(z.literal("")),
  cancellationNotes: z.string().trim().max(MAX_NOTES).nullable().optional(),
});

export type SubscriptionCancellationOverrideInput = z.infer<
  typeof subscriptionCancellationOverrideSchema
>;

export interface SubscriptionCancellationOverride {
  cancellationUrl: string | null;
  cancellationNotes: string | null;
}

async function _setSubscriptionCancellationOverride(
  subscriptionId: string,
  input: SubscriptionCancellationOverrideInput
): Promise<ActionState<SubscriptionCancellationOverride>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:update"
    );
    const parsed = subscriptionCancellationOverrideSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidInput };
    }
    const existing = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId },
      select: { id: true, cancellationUrl: true, cancellationNotes: true },
    });
    if (!existing) return { success: false, error: LIFECYCLE_ERRORS.notFound };

    const data: SubscriptionCancellationOverride = {
      cancellationUrl: parsed.data.cancellationUrl || null,
      cancellationNotes: parsed.data.cancellationNotes || null,
    };
    await prisma.subscription.update({ where: { id: subscriptionId }, data });
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "UPDATE_SUBSCRIPTION",
        entityType: "subscription",
        entityId: subscriptionId,
        changes: {
          cancellationUrl: {
            from: existing.cancellationUrl,
            to: data.cancellationUrl,
          },
          cancellationNotes: {
            from: existing.cancellationNotes,
            to: data.cancellationNotes,
          },
        },
      },
    });
    revalidatePath(`/subscriptions/${subscriptionId}`);
    return { success: true, data };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error(
      { err: error, subscriptionId },
      "setSubscriptionCancellationOverride"
    );
    return toActionError(error);
  }
}
export const setSubscriptionCancellationOverride = withLogging(
  "setSubscriptionCancellationOverride",
  _setSubscriptionCancellationOverride
);
