/**
 * Corporate card transaction auto-sync cron job
 *
 * - Runs daily at 03:00 (Vercel Cron)
 * - Collects the last 30 days of approvals for all active cards
 * - Runs SaaS matching automatically (approved transactions; cancellations excluded)
 * - Stops early at 55s to stay within Vercel's 60s limit
 */

import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  getCardApprovals,
  getLastNDaysRange,
  withRetry,
  type ApprovalItem,
  type CardCompanyCode,
  type CardCredentials,
} from "@/lib/services/hyphen";
import type { AppForMatching } from "@/lib/services/hyphen/matcher";
import {
  matchMerchant4LayerSync,
  type AppMatch,
  type CatalogWithPatterns,
} from "@/lib/services/payment/merchant-matcher";
import {
  completeSyncHistory,
  createSyncHistory,
  updateCardFailCount,
} from "@/lib/services/payment/sync-history-service";
import {
  findNonSaaSKeywordHit,
  matchMerchantWithLLM,
  type MatchSource,
} from "@/lib/services/saas-matcher";
import type { CardTransactionType, CorporateCard } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Safety margin against the Vercel function limit (60s)
const MAX_DURATION_MS = 55_000;

/** Sync result */
interface SyncResult {
  cardId: string;
  cardLast4: string | null;
  organizationId: string;
  created: number;
  updated: number;
  error?: string;
}

/**
 * Fetch the catalog (global, independent of organization)
 */
async function getCatalogsWithPatterns(): Promise<CatalogWithPatterns[]> {
  const catalogs = await prisma.saaSCatalog.findMany({
    include: {
      patterns: true,
    },
  });

  return catalogs.map((catalog) => ({
    id: catalog.id,
    name: catalog.name,
    slug: catalog.slug,
    patterns: catalog.patterns.map((p) => ({
      pattern: p.pattern,
      matchType: p.matchType as "EXACT" | "DOMAIN" | "SUBDOMAIN" | "REGEX",
      confidence: p.confidence,
    })),
  }));
}

/**
 * Sync transactions per card
 */
async function syncCardTransactions(
  card: CorporateCard,
  apps: AppForMatching[],
  catalogs: CatalogWithPatterns[]
): Promise<SyncResult> {
  const result: SyncResult = {
    cardId: card.id,
    cardLast4: card.cardLast4,
    organizationId: card.organizationId,
    created: 0,
    updated: 0,
  };

  // SyncHistory ID: declared outside so the error handler can access it
  let syncHistoryId: string | undefined;

  try {
    // Create SyncHistory (auxiliary; failure does not affect the main flow)
    try {
      const syncHistory = await createSyncHistory({
        organizationId: card.organizationId,
        type: "CARD_SYNC",
        triggeredBy: "CRON",
        corporateCardId: card.id,
      });
      syncHistoryId = syncHistory.id;
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError, cardLast4: card.cardLast4 },
        "[Cron] SyncHistory creation failed (ignored)"
      );
    }

    // Decrypt credentials
    const credentials = decryptJson<CardCredentials>(card.encryptedCredentials);

    // Query period (last 30 days)
    const { sdate, edate } = getLastNDaysRange(30);

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
        const saveResult = await saveTransaction(
          card,
          item,
          "APPROVAL",
          apps,
          catalogs
        );
        if (saveResult === "created") result.created++;
        else if (saveResult === "updated") result.updated++;
      }
    } catch (error) {
      logger.error(
        { err: error, cardLast4: card.cardLast4 },
        "[Cron] Failed to fetch approvals"
      );
    }

    // Update the sync time
    await prisma.corporateCard.update({
      where: { id: card.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    // Complete SyncHistory (auxiliary)
    try {
      if (syncHistoryId) {
        const totalRecords = result.created + result.updated;
        await completeSyncHistory(syncHistoryId, {
          status: "SUCCESS",
          totalRecords,
          successCount: totalRecords,
          failedCount: 0,
          matchedCount: result.created + result.updated,
          unmatchedCount: 0,
        });
      }
      await updateCardFailCount(card.id, true);
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError, cardLast4: card.cardLast4 },
        "[Cron] SyncHistory completion failed (ignored)"
      );
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";

    // Record the error
    await prisma.corporateCard.update({
      where: { id: card.id },
      data: {
        lastError: result.error,
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
          errorMessage: result.error,
        });
      }
      await updateCardFailCount(card.id, false);
    } catch (syncHistoryError) {
      logger.warn(
        { err: syncHistoryError, cardLast4: card.cardLast4 },
        "[Cron] SyncHistory failure update error (ignored)"
      );
    }
  }

  return result;
}

/**
 * Save transactions (with the 4-layer matching pipeline)
 */
async function saveTransaction(
  card: CorporateCard,
  item: ApprovalItem,
  transactionType: CardTransactionType,
  apps: AppForMatching[],
  catalogs: CatalogWithPatterns[]
): Promise<"created" | "updated" | "skipped"> {
  const merchantName = item.useStore;

  // Cancelled transactions are saved without matching.
  // The literal below is the Korean "cancelled" useDiv value returned by the Hyphen card API — it must stay Korean.
  if (item.useDiv && item.useDiv.includes("취소")) {
    const transactionData = buildTransactionData(
      item,
      null,
      null,
      null,
      transactionType
    );
    return await upsertTransaction(card, item, transactionData);
  }

  // 0. Non-SaaS keyword filter (ride-hailing, food delivery, etc.)
  const nonSaaSHit = findNonSaaSKeywordHit(merchantName, item.useDiv);
  if (nonSaaSHit) {
    // Confirmed Non-SaaS → skip matching, mark UNMATCHED (the transaction is still saved)
    const transactionData = buildTransactionData(
      item,
      null,
      0,
      null,
      transactionType,
      "UNMATCHED"
    );
    return await upsertTransaction(card, item, transactionData);
  }

  // Convert to AppMatch format (including catalogId)
  const appsWithCatalog: AppMatch[] = apps.map((app) => ({
    id: app.id,
    name: app.name,
    catalogId: (app as AppMatch).catalogId || null,
  }));

  // Steps 1-3: 4-layer synchronous matching (pattern/partial/fuzzy)
  const fourLayerResult = matchMerchant4LayerSync(
    { merchantName, memo: item.useDiv },
    appsWithCatalog,
    catalogs,
    0.8 // Fuzzy matching threshold
  );

  let matchedAppId = fourLayerResult?.appId || null;
  let matchConfidence = fourLayerResult?.confidence || 0;
  let matchSource: MatchSource = fourLayerResult?.matchSource || null;

  // Step 4: LLM fallback (always runs when there is no appId)
  // Note: the LLM fallback also runs when layers 1-3 recognised SaaS but no existing app was found
  if (!matchedAppId) {
    const llmMatch = await matchMerchantWithLLM({
      organizationId: card.organizationId,
      merchantName,
      memo: item.useDiv || null,
      storeBizNo: item.storeBizNo || null,
      amount: parseFloat(item.useAmt) || null,
      currency: await getBaseCurrency(card.organizationId),
    });
    matchedAppId = llmMatch.appId;
    matchConfidence = llmMatch.confidence;
    matchSource = llmMatch.matchSource;
  }

  // UNMATCHED when there is no appId after the pipeline (Non-SaaS or no LLM match)
  const finalMatchStatus = matchedAppId ? "AUTO_MATCHED" : "UNMATCHED";
  const transactionData = buildTransactionData(
    item,
    matchedAppId,
    matchConfidence,
    matchSource,
    transactionType,
    finalMatchStatus
  );

  return await upsertTransaction(card, item, transactionData);
}

/**
 * Build transaction data
 */
function buildTransactionData(
  item: ApprovalItem,
  matchedAppId: string | null,
  matchConfidence: number | null,
  matchSource: MatchSource | null,
  transactionType: CardTransactionType,
  matchStatusOverride?: "PENDING" | "AUTO_MATCHED" | "UNMATCHED"
) {
  // Determine matchStatus: use the override if given, otherwise derive it from appId
  const matchStatus =
    matchStatusOverride ?? (matchedAppId ? "AUTO_MATCHED" : "PENDING");

  return {
    useDt: item.useDt,
    useTm: item.useTm || null,
    apprNo: item.apprNo,
    useStore: item.useStore,
    useAmt: parseFloat(item.useAmt) || 0,
    pchDt: null,
    pchNo: null,
    settleDt: item.settleDt || null,
    storeBizNo: item.storeBizNo || null,
    storeType: item.storeType || null,
    storeAddr: item.storeAddr || null,
    useDiv: item.useDiv || null,
    instMon: item.instMon || null,
    addTax: item.addTax ? parseFloat(item.addTax) : null,
    matchedAppId,
    matchConfidence: matchConfidence || null,
    matchSource: matchSource || null,
    matchStatus,
    transactionType,
  };
}

/**
 * Upsert transactions
 */
async function upsertTransaction(
  card: CorporateCard,
  item: ApprovalItem,
  transactionData: ReturnType<typeof buildTransactionData>
): Promise<"created" | "updated" | "skipped"> {
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
    await prisma.cardTransaction.update({
      where: { id: existing.id },
      data: transactionData,
    });
    return "updated";
  } else {
    await prisma.cardTransaction.create({
      data: {
        corporateCardId: card.id,
        organizationId: card.organizationId,
        ...transactionData,
      },
    });
    return "created";
  }
}

import { withCronAuth } from "@/lib/middleware";

/**
 * Cron Job Handler
 */
export const GET = withCronAuth(
  withLogging("cron:sync-cards", async (request: NextRequest) => {
    logger.info("[Cron] Corporate card transaction sync started");
    const startedAt = Date.now();

    try {
      // Fetch all active cards
      const cards = await prisma.corporateCard.findMany({
        where: { isActive: true },
      });

      logger.info(`[Cron] Cards to sync: ${cards.length}`);

      if (cards.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No cards to sync",
          results: [],
        });
      }

      // Fetch the catalog (global, once)
      const catalogs = await getCatalogsWithPatterns();
      logger.info(`[Cron] SaaS catalog loaded: ${catalogs.length} entries`);

      // Cache the app list per organization
      const appsByOrg = new Map<string, AppForMatching[]>();

      const results: SyncResult[] = [];

      for (const card of cards) {
        // Check remaining time: stop early after 55s
        if (Date.now() - startedAt >= MAX_DURATION_MS) {
          logger.warn(
            "[Cron] Time limit reached; stopping sync (partially completed)"
          );
          break;
        }

        // Fetch the organization's app list (cached, including catalogId)
        if (!appsByOrg.has(card.organizationId)) {
          const apps = await prisma.app.findMany({
            where: { organizationId: card.organizationId },
            select: { id: true, name: true, catalogId: true },
          });
          appsByOrg.set(card.organizationId, apps);
        }

        const apps = appsByOrg.get(card.organizationId) || [];

        // Run the sync (with the 4-layer pipeline)
        const result = await syncCardTransactions(card, apps, catalogs);
        results.push(result);

        logger.info(
          `[Cron] Card ${card.cardLast4} sync completed: +${result.created}, ~${result.updated}${result.error ? `, error: ${result.error}` : ""}`
        );

        // Rate limiting (500ms wait between cards)
        await delay(500);
      }

      // Aggregate
      const summary = {
        totalCards: cards.length,
        successCards: results.filter((r) => !r.error).length,
        failedCards: results.filter((r) => r.error).length,
        totalCreated: results.reduce((sum, r) => sum + r.created, 0),
        totalUpdated: results.reduce((sum, r) => sum + r.updated, 0),
      };

      logger.info(
        { summary },
        "[Cron] Corporate card transaction sync completed"
      );

      return NextResponse.json({
        success: true,
        summary,
        results,
      });
    } catch (error) {
      logger.error(
        { err: error },
        "[Cron] Corporate card transaction sync error"
      );

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  })
);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
