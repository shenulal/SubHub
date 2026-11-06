"use server";

import { getCachedSession } from "@/lib/auth/require-auth";
import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { can } from "@/lib/rbac/service";
import {
  getCardApprovals,
  getLastNDaysRange,
  withRetry,
  type ApprovalItem,
  type CardCompanyCode,
  type CardCredentials,
} from "@/lib/services/hyphen";
import {
  matchMerchant4LayerSync,
  normalizeMerchantName,
  type AppMatch,
  type CatalogWithPatterns,
} from "@/lib/services/payment/merchant-matcher";
import { findActiveSubscriptionForApp } from "@/lib/services/payment/subscription-auto-link";
import {
  completeSyncHistory,
  createSyncHistory,
  updateCardFailCount,
} from "@/lib/services/payment/sync-history-service";
import {
  checkNonSaaSCache,
  findNonSaaSKeywordHit,
  matchMerchantWithLLM,
  saveNonSaaSVendors,
  type MatchSource,
} from "@/lib/services/saas-matcher";
import type { ActionState } from "@/types";
import type { CardTransactionType, CorporateCard } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ==================== Transaction sync ====================

/**
 * Sync card transactions (manual) - 4-layer matching pipeline
 * 1. 4-layer matching (catalog/exact/partial/fuzzy) - same as CSV/cron
 * 2. Non-SaaS cache filtering
 * 3. Individual LLM calls (one at a time) - same as CSV/cron
 */
async function _syncCardTransactions(
  cardId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    triggeredBy?: "USER" | "CRON" | "RETRY";
  }
): Promise<
  ActionState<{ created: number; updated: number; syncHistoryId?: string }>
> {
  // Declared outside so the error handler can access syncHistoryId
  let syncHistoryId: string | undefined;

  try {
    const session = await getCachedSession();
    if (!session?.user?.organizationId) {
      return { success: false, message: "Authentication required" };
    }
    if (!(await can("payments:manage"))) {
      return {
        success: false,
        message: "You do not have permission to perform this action",
      };
    }

    const organizationId = session.user.organizationId;

    // Create SyncHistory (auxiliary; a failure does not affect the main flow)
    try {
      const syncHistory = await createSyncHistory({
        organizationId,
        type: "CARD_SYNC",
        triggeredBy: options?.triggeredBy ?? "USER",
        userId: session.user.id,
        corporateCardId: cardId,
      });
      syncHistoryId = syncHistory.id;
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory creation failed (ignored)"
      );
    }

    // Fetch the card
    const card = await prisma.corporateCard.findFirst({
      where: {
        id: cardId,
        organizationId,
        isActive: true,
      },
    });

    if (!card) {
      return { success: false, message: "Card not found" };
    }

    // Decrypt credentials
    const credentials = decryptJson<CardCredentials>(card.encryptedCredentials);

    // Set the query period (default: last 30 days)
    const { sdate, edate } =
      options?.startDate && options?.endDate
        ? { sdate: options.startDate, edate: options.endDate }
        : getLastNDaysRange(30);

    // Fetch apps (for matching, including catalogId)
    const apps: AppMatch[] = await prisma.app.findMany({
      where: { organizationId },
      select: { id: true, name: true, catalogId: true },
    });

    // Load SaaS catalog data (for 4-layer matching)
    const catalogsRaw = await prisma.saaSCatalog.findMany({
      include: { patterns: true },
    });
    const catalogs: CatalogWithPatterns[] = catalogsRaw.map((catalog) => ({
      id: catalog.id,
      name: catalog.name,
      slug: catalog.slug,
      patterns: catalog.patterns.map((p) => ({
        pattern: p.pattern,
        matchType: p.matchType as "EXACT" | "DOMAIN" | "SUBDOMAIN" | "REGEX",
        confidence: p.confidence,
      })),
    }));

    // Fetch custom match patterns
    const merchantPatterns = await prisma.merchantPattern.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      select: {
        pattern: true,
        appId: true,
      },
    });

    const customPatterns = merchantPatterns.map((p) => ({
      pattern: p.pattern,
      appId: p.appId,
    }));

    let created = 0;
    let updated = 0;

    // Collect approvals
    const approvalTransactions: Array<{
      item: ApprovalItem;
      transactionType: CardTransactionType;
    }> = [];

    // Fetch approvals
    try {
      const approvalResponse = await withRetry(() =>
        getCardApprovals(
          {
            cardCd: card.cardCd as CardCompanyCode,
            cardNo: credentials.cardNo,
            sdate,
            edate,
            useArea: "D",
          },
          credentials
        )
      );
      for (const item of approvalResponse.data.list) {
        approvalTransactions.push({ item, transactionType: "APPROVAL" });
      }
    } catch (error) {
      logger.error({ err: error }, "Failed to fetch card approvals");
    }

    // Separate cancelled transactions (saved without matching).
    // The cancel marker below must stay Korean: it is matched against the
    // useDiv value returned by the Korean Hyphen card API.
    const cancelledTransactions: typeof approvalTransactions = [];
    const activeTransactions: typeof approvalTransactions = [];

    for (const tx of approvalTransactions) {
      if (tx.item.useDiv && tx.item.useDiv.includes("취소")) {
        cancelledTransactions.push(tx);
      } else {
        activeTransactions.push(tx);
      }
    }

    // Phase 1: 4-layer matching (catalog/exact/partial/fuzzy) - same as CSV/cron
    const matched: Array<{
      item: ApprovalItem;
      transactionType: CardTransactionType;
      matchResult: { appId: string | null; confidence: number };
      matchSource: MatchSource;
    }> = [];

    const unmatched: Array<{
      item: ApprovalItem;
      transactionType: CardTransactionType;
    }> = [];

    for (const tx of activeTransactions) {
      // Check custom patterns first (organization-defined patterns)
      const customHit = customPatterns.find((p) =>
        tx.item.useStore.toLowerCase().includes(p.pattern.toLowerCase())
      );
      if (customHit) {
        matched.push({
          ...tx,
          matchResult: { appId: customHit.appId, confidence: 1 },
          matchSource: "PATTERN",
        });
        continue;
      }

      // 4-layer synchronous matching (pattern/partial/fuzzy)
      const fourLayerResult = matchMerchant4LayerSync(
        { merchantName: tx.item.useStore, memo: tx.item.useDiv },
        apps,
        catalogs,
        0.8
      );

      if (fourLayerResult?.appId) {
        matched.push({
          ...tx,
          matchResult: {
            appId: fourLayerResult.appId,
            confidence: fourLayerResult.confidence,
          },
          matchSource: fourLayerResult.matchSource,
        });
      } else {
        unmatched.push(tx);
      }
    }

    // Phase 2: Non-SaaS cache filtering
    const normalizedNames = unmatched.map((tx) =>
      normalizeMerchantName(tx.item.useStore)
    );
    const nonSaaSCache = await checkNonSaaSCache(
      organizationId,
      normalizedNames
    );

    const needsLLM: typeof unmatched = [];
    const cachedNonSaaS: typeof unmatched = [];
    const keywordNonSaaS: typeof unmatched = [];
    const keywordNonSaaSVendors: Array<{
      normalizedName: string;
      originalName: string;
      confidence: number;
      reasoning?: string;
    }> = [];

    for (const tx of unmatched) {
      const normalized = normalizeMerchantName(tx.item.useStore);
      if (nonSaaSCache.has(normalized)) {
        cachedNonSaaS.push(tx);
        continue;
      }

      const keywordHit = findNonSaaSKeywordHit(
        tx.item.useStore,
        tx.item.useDiv || null
      );
      if (keywordHit) {
        keywordNonSaaS.push(tx);
        keywordNonSaaSVendors.push({
          normalizedName: normalized,
          originalName: tx.item.useStore,
          confidence: 1,
          reasoning: `Keyword excluded: ${keywordHit}`,
        });
      } else {
        needsLLM.push(tx);
      }
    }

    if (keywordNonSaaSVendors.length > 0) {
      await saveNonSaaSVendors(organizationId, keywordNonSaaSVendors);
    }

    console.log(
      `[Sync] ${approvalTransactions.length} approvals (${activeTransactions.length} active, ${cancelledTransactions.length} cancelled) - 4-layer matched ${matched.length}, NonSaaS cache ${cachedNonSaaS.length}, keyword excluded ${keywordNonSaaS.length}, needs LLM ${needsLLM.length}`
    );

    // Phase 3: individual LLM calls (one at a time) - same as CSV/cron
    const llmResultsMap = new Map<
      string,
      { appId: string | null; confidence: number; matchSource: MatchSource }
    >();

    const baseCurrency = await getBaseCurrency(organizationId);
    for (const tx of needsLLM) {
      const key = `${tx.item.apprNo}_${tx.item.useDt}`;
      const llmMatch = await matchMerchantWithLLM({
        organizationId,
        merchantName: tx.item.useStore,
        memo: tx.item.useDiv || null,
        storeBizNo: tx.item.storeBizNo || null,
        amount: parseFloat(tx.item.useAmt) || null,
        currency: baseCurrency,
      });
      llmResultsMap.set(key, {
        appId: llmMatch.appId,
        confidence: llmMatch.confidence,
        matchSource: llmMatch.matchSource,
      });
    }

    // Phase 4: save all transactions
    for (const tx of matched) {
      const result = await saveTransactionDirect(
        card,
        tx.item,
        tx.transactionType,
        organizationId,
        tx.matchResult.appId,
        tx.matchResult.confidence,
        tx.matchSource
      );
      if (result === "created") created++;
      else if (result === "updated") updated++;
    }

    const nonSaaSResolved = [...cachedNonSaaS, ...keywordNonSaaS];
    for (const tx of nonSaaSResolved) {
      const result = await saveTransactionDirect(
        card,
        tx.item,
        tx.transactionType,
        organizationId,
        null,
        0,
        null,
        "UNMATCHED"
      );
      if (result === "created") created++;
      else if (result === "updated") updated++;
    }

    for (const tx of needsLLM) {
      const key = `${tx.item.apprNo}_${tx.item.useDt}`;
      const llmResult = llmResultsMap.get(key);
      const llmAppId = llmResult?.appId || null;
      // UNMATCHED if there is no appId after the pipeline
      const llmMatchStatus = llmAppId ? "AUTO_MATCHED" : "UNMATCHED";
      const result = await saveTransactionDirect(
        card,
        tx.item,
        tx.transactionType,
        organizationId,
        llmAppId,
        llmResult?.confidence || 0,
        llmResult?.matchSource || "LLM",
        llmMatchStatus
      );
      if (result === "created") created++;
      else if (result === "updated") updated++;
    }

    // Save cancelled transactions (without matching)
    for (const tx of cancelledTransactions) {
      const result = await saveTransactionDirect(
        card,
        tx.item,
        tx.transactionType,
        organizationId,
        null,
        0,
        null
      );
      if (result === "created") created++;
      else if (result === "updated") updated++;
    }

    // Update the card sync time
    await prisma.corporateCard.update({
      where: { id: cardId },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    // SMP-123: record a sync audit log
    if (created > 0 || updated > 0) {
      await prisma.auditLog.create({
        data: {
          action: "SYNC_CARD_TRANSACTIONS",
          entityType: "CorporateCard",
          entityId: cardId,
          userId: session.user.id,
          organizationId,
          metadata: {
            cardNo: card.cardNo,
            cardNm: card.cardNm,
            created,
            updated,
            matchedCount: matched.length,
            unmatchedCount: needsLLM.length + nonSaaSResolved.length,
            dateRange: { sdate, edate },
          },
        },
      });
    }

    revalidatePath("/payments/cards");
    revalidatePath(`/payments/cards/${cardId}`);
    revalidatePath("/payments"); // SMP-123: also refresh the payments page

    const totalRecords = created + updated;
    const matchedCount = matched.length;
    const unmatchedCount =
      needsLLM.length + nonSaaSResolved.length + cancelledTransactions.length;
    const failedCount = 0;

    // Complete SyncHistory (auxiliary)
    try {
      if (syncHistoryId) {
        await completeSyncHistory(syncHistoryId, {
          status: failedCount > 0 ? "PARTIAL" : "SUCCESS",
          totalRecords,
          successCount: totalRecords,
          failedCount,
          matchedCount,
          unmatchedCount,
        });
      }
      await updateCardFailCount(cardId, true);
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory completion update failed (ignored)"
      );
    }

    return { success: true, data: { created, updated, syncHistoryId } };
  } catch (error) {
    logger.error({ err: error }, "Transaction sync failed");

    await prisma.corporateCard.update({
      where: { id: cardId },
      data: {
        lastError: error instanceof Error ? error.message : "Unknown error",
      },
    });

    // Mark SyncHistory as failed (auxiliary)
    try {
      if (syncHistoryId) {
        await completeSyncHistory(syncHistoryId, {
          status: "FAILED",
          totalRecords: 0,
          successCount: 0,
          failedCount: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
      await updateCardFailCount(cardId, false);
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError },
        "SyncHistory failure update error (ignored)"
      );
    }

    return { success: false, message: "Failed to sync transactions" };
  }
}
export const syncCardTransactions = withLogging(
  "syncCardTransactions",
  _syncCardTransactions
);

/**
 * Helper that saves a transaction directly
 * SMP-123: adds matchStatus, teamId and userId fields
 */
async function saveTransactionDirect(
  card: CorporateCard,
  item: ApprovalItem,
  transactionType: CardTransactionType,
  organizationId: string,
  matchedAppId: string | null,
  matchConfidence: number | null,
  matchSource: MatchSource | null,
  matchStatusOverride?: "PENDING" | "AUTO_MATCHED" | "UNMATCHED"
): Promise<"created" | "updated"> {
  // Determine matchStatus: use the override if given, otherwise derive from appId
  const matchStatus: "PENDING" | "AUTO_MATCHED" | "UNMATCHED" =
    matchStatusOverride ?? (matchedAppId ? "AUTO_MATCHED" : "PENDING");

  // SMP-179: auto-link the matched app's ACTIVE subscription
  const linkedSubscriptionId = await findActiveSubscriptionForApp(
    matchedAppId,
    organizationId
  );

  const transactionData: Prisma.CardTransactionUncheckedCreateInput = {
    corporateCardId: card.id,
    organizationId,
    apprNo: item.apprNo,
    useDt: item.useDt,
    useTm: item.useTm || null,
    useStore: item.useStore,
    useAmt: new Prisma.Decimal(parseFloat(item.useAmt) || 0),
    pchDt: null,
    pchNo: null,
    settleDt: item.settleDt || null,
    storeBizNo: item.storeBizNo || null,
    storeType: item.storeType || null,
    storeAddr: item.storeAddr || null,
    useDiv: item.useDiv || null,
    instMon: item.instMon || null,
    addTax: item.addTax ? new Prisma.Decimal(parseFloat(item.addTax)) : null,
    matchedAppId,
    matchConfidence: matchConfidence || null,
    matchSource: matchSource || null,
    matchStatus, // SMP-123: matchStatus field
    linkedSubscriptionId, // SMP-179: auto-linked subscription
    // SMP-123: inherit team/user assignment from the CorporateCard
    teamId: card.teamId || null,
    userId: card.assignedUserId || null,
    transactionType,
  };

  const existing = await prisma.cardTransaction.findUnique({
    where: {
      corporateCardId_apprNo_useDt: {
        corporateCardId: card.id,
        apprNo: item.apprNo,
        useDt: item.useDt,
      },
    },
  });

  if (existing) {
    // SMP-123: keep matchStatus if the existing record is AUTO_MATCHED/MANUAL
    const shouldPreserveMatchStatus =
      existing.matchStatus === "AUTO_MATCHED" ||
      existing.matchStatus === "MANUAL";

    await prisma.cardTransaction.update({
      where: { id: existing.id },
      data: {
        ...transactionData,
        // Keep matchStatus if already auto/manually matched
        matchStatus: shouldPreserveMatchStatus
          ? existing.matchStatus
          : transactionData.matchStatus,
        // Keep matchedAppId if the match was manually confirmed
        matchedAppId: shouldPreserveMatchStatus
          ? existing.matchedAppId
          : transactionData.matchedAppId,
        // SMP-179: preserve linkedSubscriptionId if already auto/manually matched
        linkedSubscriptionId: shouldPreserveMatchStatus
          ? existing.linkedSubscriptionId
          : transactionData.linkedSubscriptionId,
      },
    });
    return "updated";
  }

  await prisma.cardTransaction.create({
    data: transactionData,
  });
  return "created";
}
