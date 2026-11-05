// src/lib/services/payment/process-payment-records.ts
/**
 * Shared payment record processing
 * - Used by both the server action (importPaymentCSV) and the SSE API route (import-stream)
 */

import { getBaseCurrency } from "@/lib/fx/base-currency";
import type { PaymentCSVRow } from "@/lib/payment-csv";
import {
  matchMerchant4LayerSync,
  type AppMatch,
  type CatalogWithPatterns,
} from "@/lib/services/payment/merchant-matcher";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher.utils";
import {
  matchMerchantWithLLM,
  saveNonSaaSVendors,
} from "@/lib/services/saas-matcher";
import type { MatchSource } from "@prisma/client";
import { findActiveSubscriptionForApp } from "./subscription-auto-link";

// Progress callback invoked for each record
export interface ProcessProgressEvent {
  index: number; // 0-based
  total: number;
  merchantName: string;
  amount: number;
}

export interface ProcessPaymentRecordsInput {
  newRows: PaymentCSVRow[];
  appMatches: AppMatch[];
  catalogsWithPatterns: CatalogWithPatterns[];
  customPatterns: Array<{
    pattern: string;
    matchType: string;
    appId: string;
  }>;
  organizationId: string;
  teamId?: string;
  userId?: string;
  nonSaaSSet: Set<string>;
  batchId: string;
  onProgress?: (event: ProcessProgressEvent) => void | Promise<void>;
}

export interface ProcessPaymentRecordsOutput {
  paymentRecords: Array<Record<string, unknown>>;
  matchedCount: number;
  newNonSaaSVendors: Array<{
    normalizedName: string;
    originalName: string;
    confidence: number;
  }>;
}

/**
 * Processes CSV records in order and creates payment records.
 * The LLM fallback may be called for each record, so providing an onProgress callback
 * allows real-time progress reporting.
 */
export async function processPaymentRecords(
  input: ProcessPaymentRecordsInput
): Promise<ProcessPaymentRecordsOutput> {
  const {
    newRows,
    appMatches,
    catalogsWithPatterns,
    customPatterns,
    organizationId,
    teamId,
    userId,
    nonSaaSSet,
    batchId,
    onProgress,
  } = input;
  const baseCurrency = await getBaseCurrency(organizationId);

  let matchedCount = 0;
  const paymentRecords: Array<Record<string, unknown>> = [];
  const newNonSaaSVendors: Array<{
    normalizedName: string;
    originalName: string;
    confidence: number;
  }> = [];

  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    const normalizedMerchant = normalizeMerchantName(row.merchantName);

    // Invoke the progress callback (before the LLM call, to report the record being processed)
    if (onProgress) {
      await onProgress({
        index: i,
        total: newRows.length,
        merchantName: row.merchantName,
        amount: row.amount,
      });
    }

    // Check custom patterns first (with normalisation)
    let matchResult = null;
    let matchSource: MatchSource | null = null;
    for (const customPattern of customPatterns) {
      const patternNormalized = normalizeMerchantName(customPattern.pattern);

      let isMatch = false;
      if (customPattern.matchType === "EXACT") {
        isMatch = normalizedMerchant === patternNormalized;
      } else if (customPattern.matchType === "CONTAINS") {
        isMatch = normalizedMerchant.includes(patternNormalized);
      }

      if (isMatch) {
        matchResult = {
          appId: customPattern.appId,
          confidence: 1.0,
          matchSource: "PATTERN" as MatchSource,
        };
        matchSource = "PATTERN" as MatchSource;
        break;
      }
    }

    // If no custom pattern matches, use 4-layer matching (LLM excluded)
    if (!matchResult) {
      const catalogMatch = matchMerchant4LayerSync(
        {
          merchantName: row.merchantName,
          memo: row.memo,
          amount: row.amount,
        },
        appMatches,
        catalogsWithPatterns
      );
      if (
        catalogMatch &&
        (catalogMatch.appId ||
          (catalogMatch.appName && catalogMatch.confidence > 0))
      ) {
        matchResult = {
          appId: catalogMatch.appId,
          confidence: catalogMatch.confidence,
          matchSource: catalogMatch.matchSource,
        };
        matchSource = catalogMatch.matchSource;
      }
    }

    // LLM fallback (skipped if in the non-SaaS cache)
    if (!matchResult?.appId && !nonSaaSSet.has(normalizedMerchant)) {
      const llmMatch = await matchMerchantWithLLM({
        organizationId,
        merchantName: row.merchantName,
        memo: row.memo || null,
        storeBizNo: null,
        amount: row.amount,
        currency: baseCurrency,
        teamId: teamId || undefined,
        userId: userId || undefined,
      });
      matchResult = llmMatch;
      matchSource = llmMatch.matchSource || ("LLM" as MatchSource);

      if (!llmMatch.appId && llmMatch.matchSource === "LLM") {
        newNonSaaSVendors.push({
          normalizedName: normalizedMerchant,
          originalName: row.merchantName,
          confidence: llmMatch.confidence || 0,
        });
      }
    }

    if (matchResult?.appId) {
      matchedCount++;
    }

    // SMP-179: auto-link the matched app's ACTIVE subscription
    const linkedSubscriptionId = await findActiveSubscriptionForApp(
      matchResult?.appId || null,
      organizationId
    );

    paymentRecords.push({
      organizationId,
      transactionDate: row.transactionDate,
      merchantName: row.merchantName,
      amount: row.amount,
      currency: baseCurrency,
      cardLast4: row.cardLast4 || null,
      approvalNumber: row.approvalNumber || null,
      category: row.category || null,
      memo: row.memo || null,
      matchedAppId: matchResult?.appId || null,
      matchConfidence: matchResult?.confidence || null,
      matchStatus: matchResult?.appId ? "AUTO_MATCHED" : "UNMATCHED",
      matchSource: matchSource,
      linkedSubscriptionId,
      importBatchId: batchId,
      rawData: row.rawData,
      teamId: teamId || null,
      userId: userId || null,
    });
  }

  // Save non-SaaS vendors to the cache
  if (newNonSaaSVendors.length > 0) {
    await saveNonSaaSVendors(organizationId, newNonSaaSVendors);
  }

  return { paymentRecords, matchedCount, newNonSaaSVendors };
}
