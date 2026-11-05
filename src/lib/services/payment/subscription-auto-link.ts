// src/lib/services/payment/subscription-auto-link.ts
/**
 * Payment record → subscription auto-link utility
 * For payment records with matchedAppId set, finds and links the app's ACTIVE subscription.
 */

import { prisma } from "@/lib/db";

/**
 * Returns the ACTIVE subscription ID for the given app.
 * - Returns null without a DB call when appId is null
 * - The Subscription model's @@unique([appId, organizationId]) allows at most one subscription per app
 * - Returns subscription.id only when the status is ACTIVE
 */
export async function findActiveSubscriptionForApp(
  appId: string | null,
  organizationId: string
): Promise<string | null> {
  if (!appId) return null;

  const subscription = await prisma.subscription.findUnique({
    where: {
      appId_organizationId: {
        appId,
        organizationId,
      },
    },
    select: { id: true, status: true },
  });

  if (!subscription || subscription.status !== "ACTIVE") return null;

  return subscription.id;
}
