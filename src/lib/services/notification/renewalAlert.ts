// src/lib/services/notification/renewalAlert.ts
import { prisma } from "@/lib/db";
import type { AlertType } from "@prisma/client";
import { sendRenewalAlertEmail } from "./email";
import {
  processSubscriptionReminders,
  type ReminderRunOptions,
  type ReminderRunResult,
} from "./reminders";

// AlertType mapping by days remaining until renewal
function getAlertType(days: number): AlertType {
  if (days === 30) return "DAYS_30";
  if (days === 60) return "DAYS_60";
  if (days === 90) return "DAYS_90";
  throw new Error(`Invalid days: ${days}`);
}

// Upcoming-renewal subscription type
export type UpcomingRenewal = Awaited<
  ReturnType<typeof findUpcomingRenewals>
>[number];

// Find subscriptions due for renewal
export async function findUpcomingRenewals(daysUntilRenewal: 30 | 60 | 90) {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + daysUntilRenewal);

  // Date range (±1 day)
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 1);

  const alertField =
    daysUntilRenewal === 30
      ? "renewalAlert30"
      : daysUntilRenewal === 60
        ? "renewalAlert60"
        : "renewalAlert90";

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      renewalDate: {
        gte: startDate,
        lte: endDate,
      },
      [alertField]: true,
    },
    include: {
      app: {
        select: {
          name: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return subscriptions;
}

// Single alert send result
export interface SendAlertResult {
  subscriptionId: string;
  sent: number;
  failed: number;
  skipped?: boolean;
  error?: string;
}

// Send renewal alerts for a single subscription
export async function sendRenewalAlert(
  subscription: UpcomingRenewal,
  daysUntilRenewal: 30 | 60 | 90
): Promise<SendAlertResult> {
  const alertType = getAlertType(daysUntilRenewal);

  // Check whether the alert was already sent
  const existingAlert = await prisma.renewalAlert.findFirst({
    where: {
      subscriptionId: subscription.id,
      alertType,
      sentAt: { not: null },
    },
  });

  if (existingAlert) {
    return {
      subscriptionId: subscription.id,
      sent: 0,
      failed: 0,
      skipped: true,
    };
  }

  // Load the organization's admins
  const admins = await prisma.user.findMany({
    where: {
      organizationId: subscription.organization.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      email: true,
    },
  });

  if (admins.length === 0) {
    return {
      subscriptionId: subscription.id,
      sent: 0,
      failed: 0,
      error: "No admin found",
    };
  }

  let sent = 0;
  let failed = 0;

  // E-mail each admin
  for (const admin of admins) {
    const result = await sendRenewalAlertEmail({
      to: admin.email,
      appName: subscription.app.name,
      renewalDate: subscription.renewalDate!,
      daysUntilRenewal,
      amount: Number(subscription.amount),
      currency: subscription.currency,
      organizationName: subscription.organization.name,
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  // Save the alert record
  const scheduledFor = subscription.renewalDate!;
  await prisma.renewalAlert.upsert({
    where: {
      subscriptionId_alertType: {
        subscriptionId: subscription.id,
        alertType,
      },
    },
    create: {
      subscriptionId: subscription.id,
      alertType,
      scheduledFor,
      sentAt: new Date(),
    },
    update: {
      sentAt: new Date(),
    },
  });

  return {
    subscriptionId: subscription.id,
    sent,
    failed,
  };
}

// Overall renewal alert result (legacy cron → delegated to the reminders service)
export type ProcessResult = ReminderRunResult & { legacy: true };

/**
 * Legacy 30/60/90-day renewal alerts. Delegates to the unified reminders
 * service, which honours the `renewalAlert30/60/90` flags on each subscription
 * and records `ReminderDispatch` rows (no duplicate sends with the new cron).
 */
export async function processRenewalAlerts(
  options: ReminderRunOptions = {}
): Promise<ProcessResult> {
  const result = await processSubscriptionReminders({
    ...options,
    legacyFlagsOnly: true,
  });
  return { ...result, legacy: true };
}
