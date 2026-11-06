"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import { can } from "@/lib/rbac/service";
import { getSyncHistories } from "@/lib/services/payment/sync-history-service";
import type { ActionState } from "@/types";
import type { SyncHistory, SyncType } from "@prisma/client";

export interface GetSyncHistoryFilters {
  corporateCardId?: string;
  type?: SyncType;
  page?: number;
  limit?: number;
}

/**
 * Server Action: get sync history
 * organizationId is taken from the session automatically.
 */
export async function getSyncHistory(
  filters: GetSyncHistoryFilters
): Promise<ActionState<{ data: SyncHistory[]; total: number }>> {
  try {
    const session = await getCachedSession();

    if (!session?.user) {
      return { success: false, error: "Authentication required" };
    }
    if (!(await can("payments:read"))) {
      return {
        success: false,
        error: "You do not have permission to perform this action",
      };
    }

    if (!session.user.organizationId) {
      return { success: false, error: "Organization information is required" };
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;

    const result = await getSyncHistories({
      organizationId: session.user.organizationId,
      corporateCardId: filters.corporateCardId,
      type: filters.type,
      limit,
      offset,
    });

    return { success: true, data: result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load sync history";
    return { success: false, error: message };
  }
}
