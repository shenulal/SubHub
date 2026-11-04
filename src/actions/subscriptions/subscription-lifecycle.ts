"use server";

/**
 * Subscription lifecycle: pause / resume / archive / restore / cancel,
 * bulk updates and the duplicate-check wrapper.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  findSimilarSubscriptions,
  type SimilarSubscription,
} from "@/lib/services/subscription/duplicates";
import {
  bulkUpdateIdsSchema,
  bulkUpdatePatchSchema,
  cancelSubscriptionSchema,
  duplicateCheckSchema,
  type BulkUpdatePatch,
} from "@/lib/validations/subscriptions";
import type { ActionState } from "@/types";
import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  buildTransitionPatch,
  canTransition,
  isNextNavigationError,
  LIFECYCLE_AUDIT_ACTION,
  LIFECYCLE_ERRORS,
  toActionError,
  type LifecycleAction,
} from "./subscription-lifecycle.helpers";
import { ensureTags } from "./taxonomy-adapter";

export interface LifecycleResult {
  id: string;
  status: SubscriptionStatus;
}

function revalidateSubscription(id: string) {
  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${id}`);
}

async function readPreviousStatus(
  subscriptionId: string
): Promise<SubscriptionStatus | null> {
  const entry = await prisma.auditLog.findFirst({
    where: {
      entityId: subscriptionId,
      action: LIFECYCLE_AUDIT_ACTION.archive,
    },
    orderBy: { createdAt: "desc" },
    select: { changes: true },
  });
  const from = (entry?.changes as { from?: string } | null)?.from;
  return (from as SubscriptionStatus | undefined) ?? null;
}

async function transition(
  id: string,
  action: LifecycleAction,
  effectiveDate?: Date | null
): Promise<ActionState<LifecycleResult>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:update"
    );
    const existing = await prisma.subscription.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, app: { select: { name: true } } },
    });
    if (!existing) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    if (!canTransition(action, existing.status)) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidTransition };
    }

    const previousStatus =
      action === "restore" ? await readPreviousStatus(id) : null;
    const patch = buildTransitionPatch(action, {
      now: new Date(),
      previousStatus,
      effectiveDate,
    });

    const updated = await prisma.subscription.update({
      where: { id },
      data: patch,
      select: { id: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: LIFECYCLE_AUDIT_ACTION[action],
        entityType: "subscription",
        entityId: id,
        changes: { from: existing.status, to: updated.status },
        metadata: {
          appName: existing.app.name,
          ...(patch.endDate ? { endDate: patch.endDate.toISOString() } : {}),
        },
      },
    });

    revalidateSubscription(id);
    return { success: true, data: updated };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, id, action }, "subscription transition failed");
    return toActionError<LifecycleResult>(error);
  }
}

export const pauseSubscription = withLogging(
  "pauseSubscription",
  async (id: string) => transition(id, "pause")
);

export const resumeSubscription = withLogging(
  "resumeSubscription",
  async (id: string) => transition(id, "resume")
);

export const archiveSubscription = withLogging(
  "archiveSubscription",
  async (id: string) => transition(id, "archive")
);

export const restoreSubscription = withLogging(
  "restoreSubscription",
  async (id: string) => transition(id, "restore")
);

export const cancelSubscription = withLogging(
  "cancelSubscription",
  async (
    id: string,
    options: { effectiveDate?: Date | string | null } = {}
  ): Promise<ActionState<LifecycleResult>> => {
    const parsed = cancelSubscriptionSchema.safeParse({
      effectiveDate: options.effectiveDate ?? undefined,
    });
    if (!parsed.success) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidInput };
    }
    return transition(id, "cancel", parsed.data.effectiveDate ?? null);
  }
);

// ─── Bulk update ─────────────────────────────────────────────────

async function applyBulkTags(
  subscriptionIds: string[],
  patch: BulkUpdatePatch
): Promise<void> {
  if (patch.removeTagIds?.length) {
    await prisma.subscriptionTag.deleteMany({
      where: {
        subscriptionId: { in: subscriptionIds },
        tagId: { in: patch.removeTagIds },
      },
    });
  }
  if (patch.addTagNames?.length) {
    const tags = await ensureTags(patch.addTagNames);
    if (tags.length) {
      await prisma.subscriptionTag.createMany({
        data: subscriptionIds.flatMap((subscriptionId) =>
          tags.map((tag) => ({ subscriptionId, tagId: tag.id }))
        ),
        skipDuplicates: true,
      });
    }
  }
}

function buildBulkColumnPatch(
  patch: BulkUpdatePatch,
  now: Date
): Prisma.SubscriptionUncheckedUpdateManyInput {
  const data: Prisma.SubscriptionUncheckedUpdateManyInput = {};
  if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
  if (patch.ownerId !== undefined) data.ownerId = patch.ownerId;
  if (patch.costCenterId !== undefined) data.costCenterId = patch.costCenterId;
  if (patch.archive) {
    data.status = "ARCHIVED";
    data.archivedAt = now;
  }
  return data;
}

async function _bulkUpdateSubscriptions(
  ids: string[],
  patch: BulkUpdatePatch
): Promise<ActionState<{ updated: number }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("subscriptions:bulk");
    const idsResult = bulkUpdateIdsSchema.safeParse(ids);
    const patchResult = bulkUpdatePatchSchema.safeParse(patch);
    if (!idsResult.success) {
      return { success: false, error: LIFECYCLE_ERRORS.noIds };
    }
    if (!patchResult.success) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidInput };
    }

    // Only touch rows inside the caller's organisation.
    const owned = await prisma.subscription.findMany({
      where: { id: { in: idsResult.data }, organizationId },
      select: { id: true, status: true },
    });
    if (owned.length === 0) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    const ownedIds = owned.map((s) => s.id);
    const now = new Date();
    const columnPatch = buildBulkColumnPatch(patchResult.data, now);

    if (Object.keys(columnPatch).length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: ownedIds }, organizationId },
        data: columnPatch,
      });
    }
    await applyBulkTags(ownedIds, patchResult.data);

    await prisma.auditLog.createMany({
      data: owned.map((sub) => ({
        organizationId,
        userId,
        action: "BULK_UPDATE_SUBSCRIPTIONS",
        entityType: "subscription",
        entityId: sub.id,
        changes: {
          ...patchResult.data,
          ...(patchResult.data.archive
            ? { from: sub.status, to: "ARCHIVED" }
            : {}),
        } as Prisma.InputJsonValue,
      })),
    });

    revalidatePath("/subscriptions");
    return { success: true, data: { updated: ownedIds.length } };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error }, "bulk subscription update failed");
    return toActionError<{ updated: number }>(error);
  }
}
export const bulkUpdateSubscriptions = withLogging(
  "bulkUpdateSubscriptions",
  _bulkUpdateSubscriptions
);

// ─── Duplicate check ─────────────────────────────────────────────

async function _checkDuplicate(
  name: string,
  vendorDomain?: string | null,
  excludeId?: string
): Promise<ActionState<SimilarSubscription[]>> {
  try {
    const { organizationId } = await requirePermission("subscriptions:read");
    const parsed = duplicateCheckSchema.safeParse({
      name,
      vendorDomain,
      excludeId,
    });
    if (!parsed.success) {
      return { success: false, error: LIFECYCLE_ERRORS.invalidInput };
    }
    const matches = await findSimilarSubscriptions(
      organizationId,
      { name: parsed.data.name, vendorDomain: parsed.data.vendorDomain },
      { excludeId: parsed.data.excludeId }
    );
    return { success: true, data: matches };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error }, "duplicate check failed");
    return toActionError<SimilarSubscription[]>(error);
  }
}
export const checkDuplicate = withLogging("checkDuplicate", _checkDuplicate);
