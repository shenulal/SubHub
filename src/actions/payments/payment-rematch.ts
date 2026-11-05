"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import {
  rematchRecords,
  type RematchResult,
} from "@/lib/services/payment/rematch-service";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

/**
 * Server Action: rematch payment records (PaymentRecord)
 * Rematches UNMATCHED/PENDING items via rematch-service.
 */
export async function rematchPaymentRecords(
  recordIds: string[]
): Promise<ActionState<RematchResult>> {
  try {
    const session = await getCachedSession();

    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return { success: false, error: "Organization information is required" };
    }

    const result = await rematchRecords({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      recordType: "payment",
      recordIds,
    });

    revalidatePath("/payments");
    return { success: true, data: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rematching failed";
    return { success: false, error: message };
  }
}

/**
 * Server Action: rematch card transactions (CardTransaction)
 * Rematches UNMATCHED/PENDING items via rematch-service.
 */
export async function rematchCardTransactions(
  transactionIds: string[]
): Promise<ActionState<RematchResult>> {
  try {
    const session = await getCachedSession();

    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }

    if (!session.user.organizationId) {
      return { success: false, error: "Organization information is required" };
    }

    const result = await rematchRecords({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      recordType: "card-transaction",
      recordIds: transactionIds,
    });

    revalidatePath("/payments");
    return { success: true, data: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Rematching failed";
    return { success: false, error: message };
  }
}
