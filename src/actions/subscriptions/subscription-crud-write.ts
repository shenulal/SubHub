// src/actions/subscriptions/subscription-crud-write.ts
"use server";

/**
 * Subscription create/update/delete Server Actions
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { computeCancellationDeadline } from "@/lib/services/subscription/contract-terms";
import { getSettings } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  blankToNull,
  parseSubscriptionFormData,
  toDateOrNull,
  type ParsedSubscriptionForm,
} from "./subscription-crud-write.parse";
import {
  prepareAssignments,
  prepareCustomFields,
  resolveApp,
  syncAssignments,
  syncCustomFields,
  syncTags,
} from "./subscription-crud-write.relations";
import {
  createSubscriptionSchema,
  isRedirectError,
  updateSubscriptionSchema,
  type CreateSubscriptionData,
} from "./subscription-crud.types";

type IdResult = ActionState<{ id: string }>;

const MESSAGES = {
  forbidden: "You do not have permission to perform this action",
  appNotFound: "App not found",
  notFound: "Subscription not found",
  duplicateApp: "A subscription for this service already exists",
  assignAdminOnly: "Only admins can assign users",
  createError: "An error occurred while creating the subscription",
  updateError: "An error occurred while updating the subscription",
  deleteError: "An error occurred while deleting the subscription",
} as const;

const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): IdResult {
  return {
    success: false,
    errors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

/** Resolve contract-term defaults from settings and compute the deadline. */
async function contractTerms(
  organizationId: string,
  data: Pick<
    CreateSubscriptionData,
    "endDate" | "noticePeriodDays" | "reminderLeadDays"
  >
): Promise<{
  noticePeriodDays: number | null;
  cancellationDeadline: Date | null;
  reminderLeadDays: number[];
}> {
  const settings = await getSettings(organizationId, [
    "subscriptions.defaultNoticePeriodDays",
    "subscriptions.defaultReminderLeadDays",
  ]);
  const endDate = toDateOrNull(blankToNull(data.endDate));
  const noticePeriodDays =
    data.noticePeriodDays ??
    (endDate ? settings["subscriptions.defaultNoticePeriodDays"] : null);
  return {
    noticePeriodDays,
    cancellationDeadline: computeCancellationDeadline({
      endDate,
      noticePeriodDays,
    }),
    reminderLeadDays:
      data.reminderLeadDays ??
      settings["subscriptions.defaultReminderLeadDays"],
  };
}

/** Columns shared by create and update. */
function columnData(
  data: CreateSubscriptionData,
  raw: ParsedSubscriptionForm,
  usedLicenses: number | null,
  terms: Awaited<ReturnType<typeof contractTerms>>,
  ownerId: string | null
): Omit<Prisma.SubscriptionUncheckedCreateInput, "appId" | "organizationId"> {
  return {
    billingCycle: data.billingCycle,
    billingType: data.billingType,
    amount: parseFloat(data.amount),
    perSeatPrice: raw.perSeatPrice ? parseFloat(raw.perSeatPrice) : null,
    currency: data.currency,
    totalLicenses: data.totalLicenses || null,
    usedLicenses,
    startDate: new Date(data.startDate),
    endDate: toDateOrNull(blankToNull(data.endDate)),
    renewalDate: toDateOrNull(blankToNull(data.renewalDate)),
    autoRenewal: data.autoRenewal,
    renewalAlert30: data.renewalAlert30,
    renewalAlert60: data.renewalAlert60,
    renewalAlert90: data.renewalAlert90,
    contractUrl: blankToNull(data.contractUrl),
    notes: blankToNull(data.notes),
    categoryId: blankToNull(data.categoryId),
    paymentMethodId: blankToNull(data.paymentMethodId),
    costCenterId: blankToNull(data.costCenterId),
    taxRateId: blankToNull(data.taxRateId),
    isTrial: data.isTrial,
    trialEndsAt: data.isTrial
      ? toDateOrNull(blankToNull(data.trialEndsAt))
      : null,
    noticePeriodDays: terms.noticePeriodDays,
    cancellationDeadline: terms.cancellationDeadline,
    reminderLeadDays: terms.reminderLeadDays,
    isPersonal: data.isPersonal,
    ownerId,
    cancellationUrl: blankToNull(data.cancellationUrl),
    cancellationNotes: blankToNull(data.cancellationNotes),
  };
}

/**
 * Create a subscription
 */
async function _createSubscription(
  _prevState: IdResult,
  formData: FormData
): Promise<IdResult> {
  try {
    const { organizationId, userId, permissions } = await requirePermission(
      "subscriptions:create"
    );
    const raw = parseSubscriptionFormData(formData);
    const result = createSubscriptionSchema.safeParse(raw);
    if (!result.success) return fieldErrors(result.error);
    const data = result.data;

    const app = await resolveApp(organizationId, data);
    if (!app) return { success: false, message: MESSAGES.appNotFound };

    if (
      data.assignedUserIds.length > 0 &&
      !permissions.has("subscriptions:assign")
    ) {
      return { success: false, message: MESSAGES.assignAdminOnly };
    }
    const plan = await prepareAssignments(organizationId, app.id, userId, {
      teamId: data.teamId ?? null,
      teamIds: data.teamIds,
      assignedUserIds: data.assignedUserIds,
    });
    if (plan.error) return { success: false, message: plan.error };

    const customFields = await prepareCustomFields(
      organizationId,
      data.customFields
    );
    if (customFields.errors)
      return { success: false, errors: customFields.errors };

    const terms = await contractTerms(organizationId, data);
    const ownerId = blankToNull(data.ownerId) ?? userId;
    const usedLicenses =
      plan.userIds.length > 0 ? plan.userIds.length : data.usedLicenses || null;

    const subscription = await prisma.subscription.create({
      data: {
        appId: app.id,
        organizationId,
        ...columnData(data, raw, usedLicenses, terms, ownerId),
        teamId: plan.teamIds[0] ?? null,
      },
    });

    await syncAssignments(subscription.id, userId, plan, "create");
    await syncTags(subscription.id, data.tagNames, "create");
    await syncCustomFields(subscription.id, customFields, "create");

    await prisma.auditLog.create({
      data: {
        action: "CREATE_SUBSCRIPTION",
        entityType: "subscription",
        entityId: subscription.id,
        userId,
        organizationId,
        metadata: { appName: app.name, amount: data.amount },
      },
    });

    revalidatePath("/subscriptions");
    revalidatePath(`/apps/${app.id}`);
    return { success: true, data: { id: subscription.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (isForbiddenError(error)) {
      return { success: false, message: MESSAGES.forbidden };
    }
    if (isUniqueViolation(error)) {
      return { success: false, message: MESSAGES.duplicateApp };
    }
    logger.error({ err: error }, "Subscription create error");
    return { success: false, message: MESSAGES.createError };
  }
}
export const createSubscription = withLogging(
  "createSubscription",
  _createSubscription
);

/**
 * Update a subscription
 */
async function _updateSubscription(
  id: string,
  _prevState: IdResult,
  formData: FormData
): Promise<IdResult> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:update"
    );
    const existing = await prisma.subscription.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return { success: false, message: MESSAGES.notFound };

    const raw = parseSubscriptionFormData(formData, {
      billingType: existing.billingType,
      currency: existing.currency,
      status: existing.status,
    });
    const result = updateSubscriptionSchema.safeParse({
      ...raw,
      appId: existing.appId,
    });
    if (!result.success) return fieldErrors(result.error);
    const data = result.data;

    const plan = await prepareAssignments(
      organizationId,
      existing.appId,
      userId,
      {
        teamId: data.teamId ?? null,
        teamIds: data.teamIds,
        assignedUserIds: data.assignedUserIds,
      }
    );
    if (plan.error) return { success: false, message: plan.error };

    const customFields = await prepareCustomFields(
      organizationId,
      data.customFields
    );
    if (customFields.errors)
      return { success: false, errors: customFields.errors };

    const terms = await contractTerms(organizationId, data);
    const ownerId = blankToNull(data.ownerId) ?? existing.ownerId ?? userId;
    const usedLicenses =
      plan.userIds.length > 0 ? plan.userIds.length : data.usedLicenses || null;

    const subscription = await prisma.subscription.update({
      where: { id },
      data: {
        status: data.status || existing.status,
        ...columnData(data, raw, usedLicenses, terms, ownerId),
        teamId: plan.teamIds[0] ?? null,
      },
    });

    await syncAssignments(id, userId, plan, "update");
    await syncTags(id, data.tagNames, "update");
    await syncCustomFields(id, customFields, "update");

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_SUBSCRIPTION",
        entityType: "subscription",
        entityId: subscription.id,
        userId,
        organizationId,
        changes: {
          amount: {
            from: Number(existing.amount),
            to: Number(subscription.amount),
          },
          status: { from: existing.status, to: subscription.status },
        },
        metadata: { amount: data.amount },
      },
    });

    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${id}`);
    return { success: true, data: { id: subscription.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (isForbiddenError(error)) {
      return { success: false, message: MESSAGES.forbidden };
    }
    logger.error({ err: error }, "Subscription update error");
    return { success: false, message: MESSAGES.updateError };
  }
}
export const updateSubscription = withLogging(
  "updateSubscription",
  _updateSubscription
);

/**
 * Delete a subscription
 */
async function _deleteSubscription(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:delete"
    );
    const existing = await prisma.subscription.findFirst({
      where: { id, organizationId },
      include: { app: { select: { name: true } } },
    });
    if (!existing) return { success: false, message: MESSAGES.notFound };

    await prisma.subscription.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        action: "DELETE_SUBSCRIPTION",
        entityType: "subscription",
        entityId: id,
        userId,
        organizationId,
        metadata: { appName: existing.app.name },
      },
    });

    revalidatePath("/subscriptions");
    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (isForbiddenError(error)) {
      return { success: false, message: MESSAGES.forbidden };
    }
    logger.error({ err: error }, "Subscription delete error");
    return { success: false, message: MESSAGES.deleteError };
  }
}
export const deleteSubscription = withLogging(
  "deleteSubscription",
  _deleteSubscription
);
