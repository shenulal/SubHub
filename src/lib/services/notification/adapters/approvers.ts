// src/lib/services/notification/adapters/approvers.ts
/**
 * Adapter over the Approvals agent's contract
 * (`getApproversForSubscription(subscriptionId): Promise<string[]>`).
 */
import { logger } from "@/lib/logger";
import { getApproversForSubscription } from "@/lib/services/approval/approvers";

export async function getApproverIdsForSubscription(
  subscriptionId: string
): Promise<string[]> {
  try {
    const ids = await getApproversForSubscription(subscriptionId);
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch (error) {
    logger.warn(
      { err: error, subscriptionId },
      "[reminders] approver lookup failed; continuing without approvers"
    );
    return [];
  }
}
