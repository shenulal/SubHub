// src/actions/renewal-alerts.ts
"use server";

import { getCachedSession, requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { AlertType } from "@prisma/client";
import { revalidatePath } from "next/cache";

function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.includes("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.includes("NEXT_NOT_FOUND"))
  );
}

interface RenewalAlertWithSubscription {
  id: string;
  subscriptionId: string;
  alertType: AlertType;
  scheduledFor: Date;
  sentAt: Date | null;
  createdAt: Date;
  subscription: {
    id: string;
    app: { name: string };
    renewalDate: Date | null;
    amount: number | { toNumber: () => number }; // Prisma Decimal compatible
    currency: string;
  };
}

interface GetRenewalAlertsOptions {
  sentOnly?: boolean;
  subscriptionId?: string;
}

/**
 * List renewal alerts
 */
export async function getRenewalAlerts(
  options: GetRenewalAlertsOptions = {}
): Promise<RenewalAlertWithSubscription[]> {
  const { organizationId } = await requireOrganization();

  const { sentOnly, subscriptionId } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    subscription: {
      organizationId,
    },
  };

  if (sentOnly === false) {
    where.sentAt = null;
  }

  if (subscriptionId) {
    where.subscriptionId = subscriptionId;
  }

  const alerts = await prisma.renewalAlert.findMany({
    where,
    include: {
      subscription: {
        select: {
          id: true,
          app: { select: { name: true } },
          renewalDate: true,
          amount: true,
          currency: true,
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  return alerts as RenewalAlertWithSubscription[];
}

interface CreateRenewalAlertInput {
  subscriptionId: string;
  alertType: AlertType;
  scheduledFor: Date;
}

/**
 * Create a renewal alert
 */
async function _createRenewalAlert(
  input: CreateRenewalAlertInput
): Promise<ActionState<{ id: string }>> {
  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("subscriptions:update"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const organizationId = session.user.organizationId;

    // Verify the subscription exists
    const subscription = await prisma.subscription.findFirst({
      where: { id: input.subscriptionId, organizationId },
    });

    if (!subscription) {
      return { success: false, message: "Subscription not found" };
    }

    const alert = await prisma.renewalAlert.create({
      data: {
        subscriptionId: input.subscriptionId,
        alertType: input.alertType,
        scheduledFor: input.scheduledFor,
      },
    });

    revalidatePath("/subscriptions");
    revalidatePath(`/subscriptions/${input.subscriptionId}`);

    return { success: true, data: { id: alert.id } };
  } catch (error) {
    logger.error({ err: error }, "Renewal alert creation error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while creating the renewal alert",
    };
  }
}
export const createRenewalAlert = withLogging(
  "createRenewalAlert",
  _createRenewalAlert
);

/**
 * Mark an alert as sent
 */
async function _markAlertAsSent(alertId: string): Promise<ActionState> {
  try {
    const { organizationId } = await requireOrganization();
    if (!(await can("subscriptions:update"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const alert = await prisma.renewalAlert.findFirst({
      where: { id: alertId },
      include: { subscription: { select: { organizationId: true } } },
    });

    if (!alert || alert.subscription.organizationId !== organizationId) {
      return { success: false, message: "Alert not found" };
    }

    await prisma.renewalAlert.update({
      where: { id: alertId },
      data: { sentAt: new Date() },
    });

    revalidatePath("/subscriptions");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Alert send-status update error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while updating the alert send status",
    };
  }
}
export const markAlertAsSent = withLogging("markAlertAsSent", _markAlertAsSent);

/**
 * Delete a renewal alert
 */
async function _deleteRenewalAlert(alertId: string): Promise<ActionState> {
  try {
    const { organizationId } = await requireOrganization();

    if (!(await can("settings:manage"))) {
      return { success: false, message: "Admin permission required" };
    }

    const alert = await prisma.renewalAlert.findFirst({
      where: { id: alertId },
      include: { subscription: { select: { organizationId: true } } },
    });

    if (!alert || alert.subscription.organizationId !== organizationId) {
      return { success: false, message: "Alert not found" };
    }

    await prisma.renewalAlert.delete({ where: { id: alertId } });

    revalidatePath("/subscriptions");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Renewal alert deletion error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while deleting the renewal alert",
    };
  }
}
export const deleteRenewalAlert = withLogging(
  "deleteRenewalAlert",
  _deleteRenewalAlert
);

/**
 * Auto-generate renewal alerts
 * Creates alerts automatically based on the renewal settings of active subscriptions.
 */
async function _generateRenewalAlerts(): Promise<
  ActionState<{ created: number }>
> {
  try {
    const { organizationId } = await requireOrganization();

    if (!(await can("settings:manage"))) {
      return { success: false, message: "Admin permission required" };
    }

    const now = new Date();

    // Fetch active subscriptions with a renewal date
    const subscriptions = await prisma.subscription.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        renewalDate: { not: null },
      },
      include: {
        renewalAlerts: {
          select: { alertType: true },
        },
      },
    });

    const alertsToCreate: {
      subscriptionId: string;
      alertType: AlertType;
      scheduledFor: Date;
    }[] = [];

    for (const subscription of subscriptions) {
      if (!subscription.renewalDate) continue;

      const existingTypes = new Set(
        subscription.renewalAlerts.map((a) => a.alertType)
      );

      // 30-day alert
      if (subscription.renewalAlert30 && !existingTypes.has("DAYS_30")) {
        const scheduledFor = new Date(subscription.renewalDate);
        scheduledFor.setDate(scheduledFor.getDate() - 30);
        if (scheduledFor > now) {
          alertsToCreate.push({
            subscriptionId: subscription.id,
            alertType: "DAYS_30",
            scheduledFor,
          });
        }
      }

      // 60-day alert
      if (subscription.renewalAlert60 && !existingTypes.has("DAYS_60")) {
        const scheduledFor = new Date(subscription.renewalDate);
        scheduledFor.setDate(scheduledFor.getDate() - 60);
        if (scheduledFor > now) {
          alertsToCreate.push({
            subscriptionId: subscription.id,
            alertType: "DAYS_60",
            scheduledFor,
          });
        }
      }

      // 90-day alert
      if (subscription.renewalAlert90 && !existingTypes.has("DAYS_90")) {
        const scheduledFor = new Date(subscription.renewalDate);
        scheduledFor.setDate(scheduledFor.getDate() - 90);
        if (scheduledFor > now) {
          alertsToCreate.push({
            subscriptionId: subscription.id,
            alertType: "DAYS_90",
            scheduledFor,
          });
        }
      }
    }

    if (alertsToCreate.length > 0) {
      await prisma.renewalAlert.createMany({
        data: alertsToCreate,
        skipDuplicates: true,
      });
    }

    revalidatePath("/subscriptions");

    return { success: true, data: { created: alertsToCreate.length } };
  } catch (error) {
    logger.error({ err: error }, "Renewal alert auto-generation error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while auto-generating renewal alerts",
    };
  }
}
export const generateRenewalAlerts = withLogging(
  "generateRenewalAlerts",
  _generateRenewalAlerts
);
