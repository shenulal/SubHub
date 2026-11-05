import { Prisma, SyncHistory, SyncStatus, SyncType } from "@prisma/client";

import { prisma } from "@/lib/db";

// SyncHistory creation input type
interface CreateSyncHistoryInput {
  organizationId: string;
  type: SyncType;
  triggeredBy: "USER" | "CRON" | "RETRY";
  userId?: string;
  corporateCardId?: string;
  fileName?: string;
}

// SyncHistory completion result type
interface CompleteSyncHistoryResult {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  totalRecords: number;
  successCount: number;
  failedCount: number;
  matchedCount: number;
  unmatchedCount: number;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
}

// getSyncHistories filter type
interface GetSyncHistoriesFilters {
  organizationId: string;
  corporateCardId?: string;
  type?: SyncType;
  limit?: number;
  offset?: number;
}

/**
 * Creates a new SyncHistory record in RUNNING status.
 */
export async function createSyncHistory(
  input: CreateSyncHistoryInput
): Promise<SyncHistory> {
  return prisma.syncHistory.create({
    data: {
      organizationId: input.organizationId,
      type: input.type,
      status: SyncStatus.RUNNING,
      triggeredBy: input.triggeredBy,
      userId: input.userId,
      corporateCardId: input.corporateCardId,
      fileName: input.fileName,
    },
  });
}

/**
 * Updates a SyncHistory to its completed status.
 * completedAt is always set to the current time.
 */
export async function completeSyncHistory(
  syncHistoryId: string,
  result: CompleteSyncHistoryResult
): Promise<SyncHistory> {
  return prisma.syncHistory.update({
    where: { id: syncHistoryId },
    data: {
      status: result.status as SyncStatus,
      totalRecords: result.totalRecords,
      successCount: result.successCount,
      failedCount: result.failedCount,
      matchedCount: result.matchedCount,
      unmatchedCount: result.unmatchedCount,
      errorMessage: result.errorMessage,
      errorDetails: result.errorDetails
        ? (result.errorDetails as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      completedAt: new Date(),
    },
  });
}

/**
 * Updates the corporate card's consecutiveFailCount.
 * success=true: reset to 0
 * success=false: increment by 1
 */
export async function updateCardFailCount(
  cardId: string,
  success: boolean
): Promise<{ consecutiveFailCount: number }> {
  return prisma.corporateCard.update({
    where: { id: cardId },
    data: {
      consecutiveFailCount: success ? 0 : { increment: 1 },
    },
    select: { consecutiveFailCount: true },
  });
}

/**
 * Returns a paginated list of SyncHistory records.
 * Defaults: limit=20, offset=0, sorted by startedAt descending
 */
export async function getSyncHistories(
  filters: GetSyncHistoriesFilters
): Promise<{ data: SyncHistory[]; total: number }> {
  const {
    organizationId,
    corporateCardId,
    type,
    limit = 20,
    offset = 0,
  } = filters;

  const where = {
    organizationId,
    ...(corporateCardId !== undefined && { corporateCardId }),
    ...(type !== undefined && { type }),
  };

  const [data, total] = await Promise.all([
    prisma.syncHistory.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { startedAt: "desc" },
    }),
    prisma.syncHistory.count({ where }),
  ]);

  return { data, total };
}
