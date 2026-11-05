"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import type { MatchSource, PaymentMatchStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Extract the actual ID and source from a unified ID
 * - 'card_xxx' → { source: 'card', id: 'xxx' }
 * - 'csv_xxx' → { source: 'csv', id: 'xxx' }
 * - 'xxx' → { source: null, id: 'xxx' } (legacy support)
 */
function parseUnifiedId(unifiedId: string): {
  source: "card" | "csv" | null;
  id: string;
} {
  if (unifiedId.startsWith("card_")) {
    return { source: "card", id: unifiedId.substring(5) };
  }
  if (unifiedId.startsWith("csv_")) {
    return { source: "csv", id: unifiedId.substring(4) };
  }
  // No prefix: treat as a legacy ID
  return { source: null, id: unifiedId };
}

/**
 * Update payment record matching
 * - Supports both PaymentRecord and CardTransaction
 * - Supports unified ID formats (card_xxx, csv_xxx)
 */
async function _updatePaymentMatch(
  paymentId: string,
  appId: string | null
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        message: "Only admins can change matching",
      };
    }

    // Parse the unified ID
    const { source, id: actualId } = parseUnifiedId(paymentId);

    if (source === "csv") {
      // Update PaymentRecord
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (!paymentRecord) {
        return {
          success: false,
          message: "Payment record not found",
        };
      }

      await prisma.paymentRecord.update({
        where: { id: actualId },
        data: {
          matchedAppId: appId,
          matchStatus: appId ? "MANUAL" : "UNMATCHED",
          matchSource: appId ? ("MANUAL" as MatchSource) : null,
          matchConfidence: appId ? 1.0 : null,
        },
      });
    } else if (source === "card") {
      // Update CardTransaction
      const cardTransaction = await prisma.cardTransaction.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (!cardTransaction) {
        return {
          success: false,
          message: "Payment record not found",
        };
      }

      await prisma.cardTransaction.update({
        where: { id: actualId },
        data: {
          matchedAppId: appId,
          matchStatus: appId ? "MANUAL" : "UNMATCHED",
          matchSource: appId ? ("MANUAL" as MatchSource) : null,
          matchConfidence: appId ? 1.0 : null,
        },
      });
    } else {
      // Legacy ID: look up sequentially
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (paymentRecord) {
        await prisma.paymentRecord.update({
          where: { id: actualId },
          data: {
            matchedAppId: appId,
            matchStatus: appId ? "MANUAL" : "UNMATCHED",
            matchSource: appId ? ("MANUAL" as MatchSource) : null,
            matchConfidence: appId ? 1.0 : null,
          },
        });
      } else {
        const cardTransaction = await prisma.cardTransaction.findFirst({
          where: { id: actualId, organizationId: session.user.organizationId },
        });

        if (cardTransaction) {
          await prisma.cardTransaction.update({
            where: { id: actualId },
            data: {
              matchedAppId: appId,
              matchStatus: appId ? "MANUAL" : "UNMATCHED",
              matchSource: appId ? ("MANUAL" as MatchSource) : null,
              matchConfidence: appId ? 1.0 : null,
            },
          });
        } else {
          return {
            success: false,
            message: "Payment record not found",
          };
        }
      }
    }

    revalidatePath("/payments");
    revalidatePath("/payments");

    return {
      success: true,
      message: appId ? "App matching updated" : "App matching removed",
    };
  } catch (error) {
    logger.error({ err: error }, "Matching update error");
    return {
      success: false,
      message: "An error occurred while updating the matching",
    };
  }
}
export const updatePaymentMatch = withLogging(
  "updatePaymentMatch",
  _updatePaymentMatch
);

/**
 * Link a payment record to a subscription
 * - Supports both PaymentRecord and CardTransaction
 * - Supports unified ID formats (card_xxx, csv_xxx)
 */
async function _linkPaymentToSubscription(
  paymentId: string,
  subscriptionId: string
): Promise<ActionState> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        message: "Authentication required",
      };
    }

    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }

    // Permission check: only ADMIN can link payment records
    if (session.user.role !== "ADMIN") {
      return {
        success: false,
        message: "Only admins can link payment records",
      };
    }

    // Verify the subscription belongs to the organization
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        organizationId: session.user.organizationId,
      },
    });

    if (!subscription) {
      return {
        success: false,
        message: "Subscription not found",
      };
    }

    // Parse the unified ID
    const { source, id: actualId } = parseUnifiedId(paymentId);

    if (source === "csv") {
      // Update PaymentRecord
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (!paymentRecord) {
        return {
          success: false,
          message: "Payment record not found",
        };
      }

      await prisma.paymentRecord.update({
        where: { id: actualId },
        data: { linkedSubscriptionId: subscriptionId },
      });
    } else if (source === "card") {
      // Update CardTransaction
      const cardTransaction = await prisma.cardTransaction.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (!cardTransaction) {
        return {
          success: false,
          message: "Payment record not found",
        };
      }

      await prisma.cardTransaction.update({
        where: { id: actualId },
        data: { linkedSubscriptionId: subscriptionId },
      });
    } else {
      // Legacy ID: look up sequentially
      const paymentRecord = await prisma.paymentRecord.findFirst({
        where: { id: actualId, organizationId: session.user.organizationId },
      });

      if (paymentRecord) {
        await prisma.paymentRecord.update({
          where: { id: actualId },
          data: { linkedSubscriptionId: subscriptionId },
        });
      } else {
        const cardTransaction = await prisma.cardTransaction.findFirst({
          where: { id: actualId, organizationId: session.user.organizationId },
        });

        if (cardTransaction) {
          await prisma.cardTransaction.update({
            where: { id: actualId },
            data: { linkedSubscriptionId: subscriptionId },
          });
        } else {
          return {
            success: false,
            message: "Payment record not found",
          };
        }
      }
    }

    revalidatePath("/payments");
    revalidatePath("/subscriptions");

    return {
      success: true,
      message: "Payment record linked to the subscription",
    };
  } catch (error) {
    logger.error({ err: error }, "Subscription link error");
    return {
      success: false,
      message: "An error occurred while linking the subscription",
    };
  }
}
export const linkPaymentToSubscription = withLogging(
  "linkPaymentToSubscription",
  _linkPaymentToSubscription
);

interface UpdatePaymentRecordInput {
  notes?: string;
  linkedSubscriptionId?: string | null;
  linkedAppId?: string | null;
  matchStatus?: PaymentMatchStatus;
}

/**
 * Update a payment record
 */
async function _updatePaymentRecord(
  id: string,
  input: UpdatePaymentRecordInput
): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Authentication required" };
    }
    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Admin permission required" };
    }

    const organizationId = session.user.organizationId;

    // Verify the payment record exists
    const existingRecord = await prisma.paymentRecord.findFirst({
      where: { id, organizationId },
    });

    if (!existingRecord) {
      return { success: false, message: "Payment record not found" };
    }

    await prisma.paymentRecord.update({
      where: { id },
      data: {
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.linkedSubscriptionId !== undefined && {
          linkedSubscriptionId: input.linkedSubscriptionId,
        }),
        ...(input.linkedAppId !== undefined && {
          linkedAppId: input.linkedAppId,
        }),
        ...(input.matchStatus && { matchStatus: input.matchStatus }),
      },
    });

    revalidatePath("/payments");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Payment record update error");
    return {
      success: false,
      message: "An error occurred while updating the payment record",
    };
  }
}
export const updatePaymentRecord = withLogging(
  "updatePaymentRecord",
  _updatePaymentRecord
);

/**
 * Delete a payment record
 */
async function _deletePaymentRecord(id: string): Promise<ActionState> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, message: "Authentication required" };
    }
    if (!session.user.organizationId) {
      return {
        success: false,
        message: "Organization information is required",
      };
    }
    if (session.user.role !== "ADMIN") {
      return { success: false, message: "Admin permission required" };
    }

    const organizationId = session.user.organizationId;

    // Verify the payment record exists
    const existingRecord = await prisma.paymentRecord.findFirst({
      where: { id, organizationId },
    });

    if (!existingRecord) {
      return { success: false, message: "Payment record not found" };
    }

    await prisma.paymentRecord.delete({ where: { id } });

    revalidatePath("/payments");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Payment record deletion error");
    return {
      success: false,
      message: "An error occurred while deleting the payment record",
    };
  }
}
export const deletePaymentRecord = withLogging(
  "deletePaymentRecord",
  _deletePaymentRecord
);
