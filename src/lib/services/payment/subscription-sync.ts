/**
 * Payment → subscription auto-sync service
 *
 * PRD requirements:
 * - Create a Subscription only when there is a recurring payment pattern
 * - 2+ recurring occurrences → Subscription upsert
 * - Update an existing Subscription (amount, renewal date)
 */

import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import type { BillingCycle as PrismaBillingCycle } from "@prisma/client";
import {
  analyzePaymentIntervals,
  type BillingCycle,
  type RecurrencePattern,
} from "./recurrence";

interface PaymentTransaction {
  useDt: string;
  useStore: string;
  useAmt: string;
  matchedAppId: string | null;
}

interface SubscriptionSyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * BillingCycle mapping (recurrence -> Prisma enum)
 * Note: the Prisma enum has no SEMI_ANNUAL or ANNUAL, so these are approximated
 */
function mapBillingCycle(cycle: BillingCycle): PrismaBillingCycle {
  switch (cycle) {
    case "MONTHLY":
      return "MONTHLY";
    case "QUARTERLY":
      return "QUARTERLY";
    case "SEMI_ANNUAL":
      return "QUARTERLY"; // Prisma has no SEMI_ANNUAL; approximated as QUARTERLY
    case "ANNUAL":
      return "YEARLY"; // Prisma uses YEARLY
    default:
      return "MONTHLY";
  }
}

/**
 * Automatically syncs subscription details from payment records
 *
 * @param organizationId Organization ID
 * @param transactions Payment records (only those with matchedAppId)
 * @returns Sync result
 */
export async function syncSubscriptionsFromPayments(
  organizationId: string,
  transactions: PaymentTransaction[]
): Promise<SubscriptionSyncResult> {
  const result: SubscriptionSyncResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // Keep only transactions with a matched app
  const matchedTransactions = transactions.filter((tx) => tx.matchedAppId);

  if (matchedTransactions.length === 0) {
    return result;
  }

  // Analyse payment intervals
  const patterns = analyzePaymentIntervals(
    matchedTransactions.map((tx) => ({
      useDt: tx.useDt,
      useStore: tx.useStore,
      useAmt: tx.useAmt,
    })),
    { stdDevThreshold: 5, minTransactionCount: 2 }
  );

  // Build the merchant → app mapping
  const merchantToApp = new Map<string, string>();
  for (const tx of matchedTransactions) {
    if (tx.matchedAppId) {
      const normalizedMerchant = tx.useStore.toLowerCase().trim();
      merchantToApp.set(normalizedMerchant, tx.matchedAppId);
    }
  }

  // Create/update subscriptions for patterns classified as recurring
  for (const [merchant, pattern] of patterns) {
    if (!pattern.isRecurring) {
      result.skipped++;
      continue;
    }

    const appId = merchantToApp.get(merchant);
    if (!appId) {
      result.skipped++;
      continue;
    }

    try {
      const syncResult = await syncSubscription(organizationId, appId, pattern);
      if (syncResult === "created") result.created++;
      else if (syncResult === "updated") result.updated++;
      else result.skipped++;
    } catch (error) {
      result.errors.push(
        `Subscription sync failed for ${merchant}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return result;
}

/**
 * Syncs a single subscription
 */
async function syncSubscription(
  organizationId: string,
  appId: string,
  pattern: RecurrencePattern
): Promise<"created" | "updated" | "skipped"> {
  // Look up the existing subscription
  const existing = await prisma.subscription.findFirst({
    where: {
      organizationId,
      appId,
    },
  });

  const billingCycle = pattern.billingCycle
    ? mapBillingCycle(pattern.billingCycle)
    : "MONTHLY";
  const amount = Math.round(pattern.avgAmount);
  const renewalDate = pattern.nextPaymentDate;
  const startDate = pattern.lastPaymentDate || new Date();

  if (existing) {
    // Update the existing subscription (amount and renewal date only)
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        amount,
        billingCycle,
        renewalDate,
        updatedAt: new Date(),
      },
    });
    return "updated";
  }

  // Create a new subscription
  await prisma.subscription.create({
    data: {
      organizationId,
      appId,
      status: "ACTIVE",
      billingCycle,
      amount,
      currency: await getBaseCurrency(organizationId),
      startDate,
      renewalDate,
      autoRenewal: true,
    },
  });

  return "created";
}

/**
 * Syncs a subscription from a specific app's payment records
 */
export async function syncAppSubscriptionFromPayments(
  organizationId: string,
  appId: string,
  transactions: { useDt: string; useAmt: string }[]
): Promise<"created" | "updated" | "skipped" | "no_pattern"> {
  if (transactions.length < 2) {
    return "no_pattern";
  }

  // Analyse payment intervals
  const patterns = analyzePaymentIntervals(
    transactions.map((tx) => ({
      useDt: tx.useDt,
      useStore: "dummy", // Single app, so the merchant name is not needed
      useAmt: tx.useAmt,
    })),
    { stdDevThreshold: 5, minTransactionCount: 2 }
  );

  // Use the first pattern
  const pattern = patterns.values().next().value as
    | RecurrencePattern
    | undefined;

  if (!pattern || !pattern.isRecurring) {
    return "no_pattern";
  }

  return syncSubscription(organizationId, appId, pattern);
}
