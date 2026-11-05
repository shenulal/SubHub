// src/lib/services/saas-matcher.ts
/**
 * Advanced SaaS matching utilities
 * - Stores LLM classification results in the SaaS master DB and uses them for matching immediately
 */

import { prisma } from "@/lib/db";
import type { MatchResult } from "@/lib/services/hyphen/matcher";
import { normalizeMerchantName } from "@/lib/services/payment/merchant-matcher";
import {
  classifyMerchantWithLLM,
  classifyMerchantsBatchWithLLM,
  type BatchMerchantInput,
  type SaaSInferencePayload,
} from "@/lib/services/saas-classifier";
import { AppSource, AppStatus, MatchType, Prisma } from "@prisma/client";

import { normalizeCategory } from "./category-normalizer";

import type {
  BatchMatchMerchant,
  BatchMatchResult,
  LlmMatchParams,
  MatchSource,
} from "./saas-matcher.types";

// Re-export types and constants for backwards compatibility
export {
  NON_SAAS_KEYWORDS,
  findNonSaaSKeywordHit,
} from "./saas-matcher.constants";
export type {
  BatchMatchMerchant,
  BatchMatchResult,
  MatchSource,
} from "./saas-matcher.types";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function upsertCatalogFromInference(
  organizationId: string,
  inference: SaaSInferencePayload["inference"]
) {
  if (!inference || !inference.canonicalName) return null;

  const slug = toSlug(inference.canonicalName);

  const existing = await prisma.saaSCatalog.findFirst({
    where: { slug },
  });

  const catalog =
    existing ||
    (await prisma.saaSCatalog.create({
      data: {
        name: inference.canonicalName,
        slug,
        category: normalizeCategory(inference.category) || "Uncategorized",
        description: inference.reasoning || null,
        website: inference.website,
        isVerified: false,
        vendorName: inference.canonicalName,
        pricingModel: inference.pricingModel ?? null,
      },
    }));

  // SMP-160: LLM pricingModel → update unverified catalog entries
  if (
    existing &&
    !existing.isVerified &&
    !existing.pricingModel &&
    inference.pricingModel
  ) {
    await prisma.saaSCatalog.update({
      where: { id: existing.id },
      data: { pricingModel: inference.pricingModel },
    });
  }

  // Persist suggested patterns to the pattern table (deduplicated)
  if (inference.suggestedPatterns?.length) {
    const existingPatterns = await prisma.saaSPattern.findMany({
      where: {
        catalogId: catalog.id,
        pattern: { in: inference.suggestedPatterns },
      },
    });
    const existingSet = new Set(existingPatterns.map((p) => p.pattern));
    const newPatterns = inference.suggestedPatterns.filter(
      (p) => !existingSet.has(p)
    );

    if (newPatterns.length > 0) {
      await prisma.saaSPattern.createMany({
        data: newPatterns.map((pattern) => ({
          catalogId: catalog.id,
          pattern,
          matchType: MatchType.DOMAIN,
          confidence: Math.min(1, Math.max(0.5, inference.confidence || 0.7)),
        })),
      });
    }
  }

  return catalog;
}

/**
 * Determines app status from confidence
 * - 80% or above (high confidence): ACTIVE (auto-confirmed)
 * - 50–80% (medium confidence): PENDING_REVIEW (user confirmation required)
 * - Below 50% (low confidence): not classified as SaaS (this function is not called)
 */
function determineAppStatus(confidence: number): AppStatus {
  if (confidence >= 0.8) {
    return AppStatus.ACTIVE;
  }
  return AppStatus.PENDING_REVIEW;
}

async function upsertAppForOrganization(
  organizationId: string,
  catalogId: string | null,
  appName: string,
  confidence: number = 0.5,
  category?: string | null
) {
  const existing = await prisma.app.findFirst({
    where: {
      organizationId,
      name: appName,
    },
  });

  const normalizedCategory = normalizeCategory(category ?? null);

  if (existing) {
    // SMP-162: if the existing app's category is null, set it from the catalog category
    if (!existing.category && normalizedCategory) {
      await prisma.app.update({
        where: { id: existing.id },
        data: { category: normalizedCategory },
      });
      return { ...existing, category: normalizedCategory };
    }
    return existing;
  }

  const status = determineAppStatus(confidence);

  return prisma.app.create({
    data: {
      organizationId,
      name: appName,
      catalogId,
      status,
      category: normalizedCategory || null,
      source: AppSource.API_SYNC,
    },
  });
}

/**
 * Auto-assigns a team after app creation (SMP-107)
 * - If teamId is given, assign to that team
 * - If only userId is given, look up the user's team and assign it
 * - If neither is given, no assignment
 * - Does not create a duplicate if an AppTeam already exists (idempotent)
 */
async function ensureAppTeamOnCreation(
  appId: string,
  teamId: string | undefined,
  userId: string | undefined
): Promise<void> {
  let targetTeamId = teamId;

  // Only userId given: look up the user's team
  if (!targetTeamId && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    targetTeamId = user?.teamId ?? undefined;
  }

  if (!targetTeamId) return;

  // Check for an existing AppTeam (prevent duplicates)
  const existing = await prisma.appTeam.findFirst({
    where: { appId, teamId: targetTeamId },
  });
  if (existing) return;

  // Create AppTeam
  await prisma.appTeam.create({
    data: {
      appId,
      teamId: targetTeamId,
      assignedBy: userId ?? null,
    },
  });
}

async function logInference(params: {
  organizationId: string;
  merchantName: string;
  normalizedName: string;
  payload: SaaSInferencePayload;
  catalogId?: string | null;
  appId?: string | null;
}) {
  const {
    organizationId,
    merchantName,
    normalizedName,
    payload,
    catalogId,
    appId,
  } = params;
  const inference = payload.inference;

  await prisma.vendorInferenceLog.create({
    data: {
      organizationId,
      merchantName,
      normalizedName,
      llmProvider: "openai",
      model: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
      confidence: inference?.confidence ?? 0,
      isSaaS: inference?.isSaaS ?? false,
      suggestedName: inference?.canonicalName,
      category: inference?.category,
      website: inference?.website,
      reasoning: inference?.reasoning ?? payload.errorCode ?? null,
      rawResult: inference
        ? (inference as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      promptTokens: payload.usage?.promptTokens,
      completionTokens: payload.usage?.completionTokens,
      totalTokens: payload.usage?.totalTokens,
      errorCode: payload.errorCode,
      catalogId: catalogId || null,
      appId: appId || null,
    },
  });
}

/**
 * LLM-based fallback matching
 * - Called when pattern/app matching fails
 * - If classified as SaaS, creates/links the Catalog/App
 */
export async function matchMerchantWithLLM(
  params: LlmMatchParams
): Promise<MatchResult & { matchSource: MatchSource }> {
  const normalized = normalizeMerchantName(params.merchantName);

  const payload = await classifyMerchantWithLLM({
    merchantName: params.merchantName,
    memo: params.memo,
    storeBizNo: params.storeBizNo,
    amount: params.amount,
    currency: params.currency,
  });
  const inference = payload.inference;

  if (!inference || !inference.isSaaS) {
    await logInference({
      organizationId: params.organizationId,
      merchantName: params.merchantName,
      normalizedName: normalized,
      payload,
    });
    return {
      appId: null,
      appName: null,
      confidence: inference?.confidence ?? 0,
      matchedBy: null,
      matchSource: "LLM",
    };
  }

  // Create or link the catalog/app
  const catalog = await upsertCatalogFromInference(
    params.organizationId,
    inference
  );
  const targetName =
    inference.canonicalName ||
    inference.suggestedPatterns?.[0] ||
    params.merchantName;
  const app = await upsertAppForOrganization(
    params.organizationId,
    catalog?.id || null,
    targetName,
    inference.confidence ?? 0.6,
    inference.category
  );

  // SMP-107: auto-assign a team after app creation
  await ensureAppTeamOnCreation(app.id, params.teamId, params.userId);

  await logInference({
    organizationId: params.organizationId,
    merchantName: params.merchantName,
    normalizedName: normalized,
    payload,
    catalogId: catalog?.id,
    appId: app?.id,
  });

  return {
    appId: app.id,
    appName: app.name,
    confidence: inference.confidence ?? 0.6,
    matchedBy: "pattern",
    matchSource: "LLM",
  };
}

// ==================== Non-SaaS cache functions ====================

/**
 * Reads the non-SaaS cache
 * Returns the set of merchant names already classified as non-SaaS
 */
export async function checkNonSaaSCache(
  organizationId: string,
  normalizedNames: string[]
): Promise<Set<string>> {
  if (normalizedNames.length === 0) return new Set();

  const cached = await prisma.nonSaaSVendor.findMany({
    where: {
      organizationId,
      normalizedName: { in: normalizedNames },
    },
    select: { normalizedName: true },
  });

  return new Set(cached.map((v) => v.normalizedName));
}

/**
 * Saves non-SaaS vendors (upsert)
 */
export async function saveNonSaaSVendors(
  organizationId: string,
  vendors: Array<{
    normalizedName: string;
    originalName: string;
    confidence: number;
    reasoning?: string;
  }>
): Promise<void> {
  if (vendors.length === 0) return;

  // Prisma createMany does not support upsert → upsert individually
  await Promise.all(
    vendors.map((v) =>
      prisma.nonSaaSVendor.upsert({
        where: {
          organizationId_normalizedName: {
            organizationId,
            normalizedName: v.normalizedName,
          },
        },
        create: {
          organizationId,
          normalizedName: v.normalizedName,
          originalName: v.originalName,
          confidence: v.confidence,
          reasoning: v.reasoning,
          transactionCount: 1,
        },
        update: {
          transactionCount: { increment: 1 },
          lastSeenAt: new Date(),
        },
      })
    )
  );
}

/**
 * Removes from the non-SaaS cache (when manually marked as SaaS)
 */
export async function removeFromNonSaaSCache(
  organizationId: string,
  normalizedName: string
): Promise<void> {
  await prisma.nonSaaSVendor.deleteMany({
    where: {
      organizationId,
      normalizedName,
    },
  });
}

// ==================== Batch matching functions ====================

/**
 * Batch LLM matching
 * - Sends multiple merchants to the LLM in one call
 * - Creates the Catalog/App when classified as SaaS
 * - Stores non-SaaS results in the cache
 */
export async function matchMerchantsBatchWithLLM(
  organizationId: string,
  merchants: BatchMatchMerchant[]
): Promise<BatchMatchResult[]> {
  if (merchants.length === 0) return [];

  // Batch LLM call
  const batchInput: BatchMerchantInput[] = merchants.map((m) => ({
    id: m.id,
    merchantName: m.merchantName,
    memo: m.memo,
    amount: m.amount,
    recurrenceHint: m.recurrenceHint,
  }));

  const batchPayload = await classifyMerchantsBatchWithLLM(batchInput);
  const resultsMap = new Map(batchPayload.results.map((r) => [r.id, r]));

  const results: BatchMatchResult[] = [];
  const nonSaaSToSave: Array<{
    normalizedName: string;
    originalName: string;
    confidence: number;
    reasoning?: string;
  }> = [];

  for (const merchant of merchants) {
    const inferenceResult = resultsMap.get(merchant.id);
    const inference = inferenceResult?.inference;
    const normalized = normalizeMerchantName(merchant.merchantName);

    if (!inference || !inference.isSaaS) {
      // Non-SaaS → add to the list to cache
      nonSaaSToSave.push({
        normalizedName: normalized,
        originalName: merchant.merchantName,
        confidence: inference?.confidence ?? 0,
        reasoning: inference?.reasoning,
      });

      results.push({
        id: merchant.id,
        appId: null,
        appName: null,
        confidence: inference?.confidence ?? 0,
        matchSource: "LLM",
        isSaaS: false,
        inference: inference ?? null,
      });

      // Write log
      await logInference({
        organizationId,
        merchantName: merchant.merchantName,
        normalizedName: normalized,
        payload: { inference: inference ?? null, usage: batchPayload.usage },
      });
    } else {
      // SaaS → create Catalog/App
      const catalog = await upsertCatalogFromInference(
        organizationId,
        inference
      );
      const targetName =
        inference.canonicalName ||
        inference.suggestedPatterns?.[0] ||
        merchant.merchantName;
      const app = await upsertAppForOrganization(
        organizationId,
        catalog?.id || null,
        targetName,
        inference.confidence ?? 0.6,
        inference.category
      );

      // SMP-107: auto-assign a team after app creation
      await ensureAppTeamOnCreation(app.id, merchant.teamId, merchant.userId);

      results.push({
        id: merchant.id,
        appId: app.id,
        appName: app.name,
        confidence: inference.confidence ?? 0.6,
        matchSource: "LLM",
        isSaaS: true,
        inference,
      });

      // Write log
      await logInference({
        organizationId,
        merchantName: merchant.merchantName,
        normalizedName: normalized,
        payload: { inference, usage: batchPayload.usage },
        catalogId: catalog?.id,
        appId: app.id,
      });
    }
  }

  // Save non-SaaS vendors in bulk
  if (nonSaaSToSave.length > 0) {
    await saveNonSaaSVendors(organizationId, nonSaaSToSave);
  }

  return results;
}

/**
 * Batch processing utility
 * Processes an array in chunks of chunkSize
 */
export async function processMerchantsInBatches<T>(
  items: T[],
  chunkSize: number,
  processor: (batch: T[]) => Promise<BatchMatchResult[]>
): Promise<BatchMatchResult[]> {
  const results: BatchMatchResult[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);
  }

  return results;
}
