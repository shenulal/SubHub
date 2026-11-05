import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { advanceToFutureDate } from "@/lib/utils/renewal-date";

export interface AutoRenewResult {
  processed: number;
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * For subscriptions with autoRenewal=true whose renewalDate is in the past,
 * automatically moves renewalDate to the next date based on billingCycle.
 */
export async function processAutoRenewals(): Promise<AutoRenewResult> {
  const now = new Date();

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      autoRenewal: true,
      billingCycle: { not: "ONE_TIME" },
      renewalDate: { lt: now },
    },
    select: {
      id: true,
      renewalDate: true,
      billingCycle: true,
      app: { select: { name: true } },
      organizationId: true,
    },
  });

  const result: AutoRenewResult = {
    processed: subscriptions.length,
    updated: 0,
    failed: 0,
    errors: [],
  };

  for (const sub of subscriptions) {
    try {
      if (!sub.renewalDate) continue;

      const nextRenewalDate = advanceToFutureDate(
        sub.renewalDate,
        sub.billingCycle
      );

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalDate: nextRenewalDate },
      });

      logger.info(
        {
          subscriptionId: sub.id,
          appName: sub.app.name,
          oldDate: sub.renewalDate.toISOString(),
          newDate: nextRenewalDate.toISOString(),
          billingCycle: sub.billingCycle,
        },
        "[AutoRenew] Renewal date updated"
      );

      result.updated++;
    } catch (error) {
      result.failed++;
      const msg = `Failed to update subscription ${sub.id} (${sub.app.name}): ${
        error instanceof Error ? error.message : "Unknown error"
      }`;
      result.errors.push(msg);
      logger.error({ err: error, subscriptionId: sub.id }, msg);
    }
  }

  return result;
}
