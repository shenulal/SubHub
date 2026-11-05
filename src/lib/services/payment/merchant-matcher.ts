// src/lib/services/payment/merchant-matcher.ts
import type { MatchSource } from "@prisma/client";

import { GLOBAL_SAAS_PATTERNS } from "./merchant-matcher.constants";
import type {
  AppMatch,
  CatalogMatchResult,
  CatalogWithPatterns,
  FourLayerMatchInput,
  FourLayerMatchResult,
  MerchantMatchResult,
} from "./merchant-matcher.types";
import {
  calculateMatchConfidence,
  calculateSimilarity,
  normalizeMerchantName,
} from "./merchant-matcher.utils";

// Re-export types and utilities for backwards compatibility
export type {
  AppMatch,
  CatalogMatchResult,
  CatalogPattern,
  CatalogWithPatterns,
  FourLayerMatchInput,
  FourLayerMatchResult,
  MerchantMatchResult,
} from "./merchant-matcher.types";
export {
  calculateMatchConfidence,
  normalizeMerchantName,
} from "./merchant-matcher.utils";

/**
 * Finds a matching catalog entry
 */
export function findMatchingCatalog(
  merchantName: string,
  catalogs: CatalogWithPatterns[],
  threshold: number = 0.7
): CatalogMatchResult | null {
  const normalized = normalizeMerchantName(merchantName);

  let bestMatch: CatalogMatchResult | null = null;
  let bestConfidence = 0;

  for (const catalog of catalogs) {
    // Compare directly with the catalog name
    const nameConfidence = calculateMatchConfidence(normalized, catalog.name);
    if (nameConfidence >= threshold && nameConfidence > bestConfidence) {
      bestMatch = {
        catalogId: catalog.id,
        catalogName: catalog.name,
        confidence: nameConfidence,
      };
      bestConfidence = nameConfidence;
    }

    // Pattern matching
    for (const pattern of catalog.patterns) {
      const patternConfidence = calculateMatchConfidence(
        normalized,
        pattern.pattern
      );
      const adjustedConfidence = patternConfidence * pattern.confidence;

      if (
        adjustedConfidence >= threshold &&
        adjustedConfidence > bestConfidence
      ) {
        bestMatch = {
          catalogId: catalog.id,
          catalogName: catalog.name,
          confidence: adjustedConfidence,
        };
        bestConfidence = adjustedConfidence;
      }
    }

    // Compare with the slug
    const slugConfidence = calculateMatchConfidence(normalized, catalog.slug);
    if (slugConfidence >= threshold && slugConfidence > bestConfidence) {
      bestMatch = {
        catalogId: catalog.id,
        catalogName: catalog.name,
        confidence: slugConfidence,
      };
      bestConfidence = slugConfidence;
    }
  }

  return bestMatch;
}

/**
 * Matches an app by merchant name
 */
export function matchMerchantToApp(
  merchantName: string,
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[],
  threshold: number = 0.7
): MerchantMatchResult | null {
  const normalized = normalizeMerchantName(merchantName);

  // 0. Global SaaS pattern matching (AWS, Slack, Notion, etc.)
  for (const { pattern, appName, confidence } of GLOBAL_SAAS_PATTERNS) {
    if (pattern.test(merchantName) || pattern.test(normalized)) {
      const matchedApp = apps.find(
        (a) => a.name.toLowerCase() === appName.toLowerCase()
      );
      if (matchedApp) {
        return {
          merchantName,
          normalizedName: normalized,
          appId: matchedApp.id,
          appName: matchedApp.name,
          catalogId: matchedApp.catalogId || undefined,
          confidence,
          matchSource: "PATTERN" as MatchSource,
        };
      }
    }
  }

  // 1. Try matching via the catalog
  const catalogMatch = findMatchingCatalog(merchantName, catalogs, threshold);

  if (catalogMatch) {
    // Find the app linked to the catalog entry
    const matchedApp = apps.find(
      (app) => app.catalogId === catalogMatch.catalogId
    );
    if (matchedApp) {
      return {
        merchantName,
        normalizedName: normalized,
        appId: matchedApp.id,
        appName: matchedApp.name,
        catalogId: catalogMatch.catalogId,
        confidence: catalogMatch.confidence,
        matchSource: "CATALOG" as MatchSource,
      };
    }
  }

  // 2. Try matching directly by app name
  let bestAppMatch: MerchantMatchResult | null = null;
  let bestConfidence = 0;

  for (const app of apps) {
    const confidence = calculateMatchConfidence(normalized, app.name);

    if (confidence >= threshold && confidence > bestConfidence) {
      bestAppMatch = {
        merchantName,
        normalizedName: normalized,
        appId: app.id,
        appName: app.name,
        catalogId: app.catalogId || undefined,
        confidence,
        matchSource: "PATTERN" as MatchSource,
      };
      bestConfidence = confidence;
    }
  }

  return bestAppMatch;
}

/**
 * Matches multiple merchant names at once
 */
export function batchMatchMerchants(
  merchantNames: string[],
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[],
  threshold: number = 0.7
): Map<string, MerchantMatchResult | null> {
  const results = new Map<string, MerchantMatchResult | null>();

  for (const merchantName of merchantNames) {
    const result = matchMerchantToApp(merchantName, apps, catalogs, threshold);
    results.set(merchantName, result);
  }

  return results;
}

// ==================== 4-layer unified matching pipeline ====================

/**
 * Layer 1: exact matching (patterns + catalog)
 * - Global SaaS patterns
 * - Catalog EXACT patterns
 * - Exact app name match
 */
function matchLayer1Exact(
  normalized: string,
  merchantName: string,
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[]
): FourLayerMatchResult | null {
  // 1-1. Global SaaS pattern matching
  for (const { pattern, appName, confidence } of GLOBAL_SAAS_PATTERNS) {
    if (pattern.test(merchantName) || pattern.test(normalized)) {
      const matchedApp = apps.find(
        (a) => a.name.toLowerCase() === appName.toLowerCase()
      );
      if (matchedApp) {
        return {
          appId: matchedApp.id,
          appName: matchedApp.name,
          catalogId: matchedApp.catalogId || undefined,
          confidence,
          matchSource: "PATTERN" as MatchSource,
          matchLayer: 1,
          normalized,
        };
      }
      // No app, but recognised as SaaS
      return {
        appId: null,
        appName,
        confidence,
        matchSource: "PATTERN" as MatchSource,
        matchLayer: 1,
        normalized,
      };
    }
  }

  // 1-2. Catalog EXACT pattern matching
  for (const catalog of catalogs) {
    for (const pattern of catalog.patterns) {
      if (pattern.matchType === "EXACT") {
        if (
          normalized === pattern.pattern.toUpperCase() ||
          merchantName.toUpperCase() === pattern.pattern.toUpperCase()
        ) {
          const matchedApp = apps.find((a) => a.catalogId === catalog.id);
          return {
            appId: matchedApp?.id || null,
            appName: matchedApp?.name || catalog.name,
            catalogId: catalog.id,
            confidence: 1.0,
            matchSource: "CATALOG" as MatchSource,
            matchLayer: 1,
            normalized,
          };
        }
      }
    }
  }

  // 1-3. Exact app name match
  for (const app of apps) {
    if (normalized === app.name.toUpperCase()) {
      return {
        appId: app.id,
        appName: app.name,
        catalogId: app.catalogId || undefined,
        confidence: 1.0,
        matchSource: "CATALOG" as MatchSource,
        matchLayer: 1,
        normalized,
      };
    }
  }

  return null;
}

/**
 * Layer 2: partial matching (LIKE search)
 * - The merchant name contains the app name, or
 * - The app name contains the merchant name
 */
function matchLayer2Partial(
  normalized: string,
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[]
): FourLayerMatchResult | null {
  let bestMatch: FourLayerMatchResult | null = null;
  let bestConfidence = 0;

  // 2-1. Partial app name matching
  for (const app of apps) {
    const appNameUpper = app.name.toUpperCase();
    if (
      normalized.includes(appNameUpper) ||
      appNameUpper.includes(normalized)
    ) {
      const shorter = Math.min(normalized.length, appNameUpper.length);
      const longer = Math.max(normalized.length, appNameUpper.length);
      const confidence = (shorter / longer) * 0.85; // Partial matches score at most 0.85

      if (confidence > bestConfidence && confidence >= 0.5) {
        bestMatch = {
          appId: app.id,
          appName: app.name,
          catalogId: app.catalogId || undefined,
          confidence,
          matchSource: "PATTERN" as MatchSource,
          matchLayer: 2,
          normalized,
        };
        bestConfidence = confidence;
      }
    }
  }

  // 2-2. Partial catalog name/slug matching
  for (const catalog of catalogs) {
    const catalogNameUpper = catalog.name.toUpperCase();
    const catalogSlugUpper = catalog.slug.toUpperCase();

    if (
      normalized.includes(catalogNameUpper) ||
      catalogNameUpper.includes(normalized) ||
      normalized.includes(catalogSlugUpper) ||
      catalogSlugUpper.includes(normalized)
    ) {
      const nameLen = catalogNameUpper.length;
      const shorter = Math.min(normalized.length, nameLen);
      const longer = Math.max(normalized.length, nameLen);
      const confidence = (shorter / longer) * 0.85;

      if (confidence > bestConfidence && confidence >= 0.5) {
        const matchedApp = apps.find((a) => a.catalogId === catalog.id);
        bestMatch = {
          appId: matchedApp?.id || null,
          appName: matchedApp?.name || catalog.name,
          catalogId: catalog.id,
          confidence,
          matchSource: "CATALOG" as MatchSource,
          matchLayer: 2,
          normalized,
        };
        bestConfidence = confidence;
      }
    }
  }

  return bestMatch;
}

/**
 * Layer 3: fuzzy matching (Levenshtein similarity)
 * - 80% or higher similarity
 */
function matchLayer3Fuzzy(
  normalized: string,
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[],
  threshold: number = 0.8
): FourLayerMatchResult | null {
  let bestMatch: FourLayerMatchResult | null = null;
  let bestSimilarity = 0;

  // 3-1. Similarity against app names
  for (const app of apps) {
    const similarity = calculateSimilarity(normalized, app.name);
    if (similarity >= threshold && similarity > bestSimilarity) {
      bestMatch = {
        appId: app.id,
        appName: app.name,
        catalogId: app.catalogId || undefined,
        confidence: similarity,
        matchSource: "PATTERN" as MatchSource,
        matchLayer: 3,
        normalized,
      };
      bestSimilarity = similarity;
    }
  }

  // 3-2. Similarity against catalog names
  for (const catalog of catalogs) {
    const similarity = calculateSimilarity(normalized, catalog.name);
    if (similarity >= threshold && similarity > bestSimilarity) {
      const matchedApp = apps.find((a) => a.catalogId === catalog.id);
      bestMatch = {
        appId: matchedApp?.id || null,
        appName: matchedApp?.name || catalog.name,
        catalogId: catalog.id,
        confidence: similarity,
        matchSource: "CATALOG" as MatchSource,
        matchLayer: 3,
        normalized,
      };
      bestSimilarity = similarity;
    }

    // Also compute similarity against catalog patterns
    for (const pattern of catalog.patterns) {
      const patternSimilarity = calculateSimilarity(
        normalized,
        pattern.pattern
      );
      const adjustedSimilarity = patternSimilarity * pattern.confidence;
      if (
        adjustedSimilarity >= threshold &&
        adjustedSimilarity > bestSimilarity
      ) {
        const matchedApp = apps.find((a) => a.catalogId === catalog.id);
        bestMatch = {
          appId: matchedApp?.id || null,
          appName: matchedApp?.name || catalog.name,
          catalogId: catalog.id,
          confidence: adjustedSimilarity,
          matchSource: "CATALOG" as MatchSource,
          matchLayer: 3,
          normalized,
        };
        bestSimilarity = adjustedSimilarity;
      }
    }
  }

  return bestMatch;
}

/**
 * 4-layer unified matching (Layers 1–3 only, LLM excluded)
 * Layer 4 (LLM) must be called separately
 */
export function matchMerchant4LayerSync(
  input: FourLayerMatchInput,
  apps: AppMatch[],
  catalogs: CatalogWithPatterns[],
  fuzzyThreshold: number = 0.8
): FourLayerMatchResult | null {
  const normalized = normalizeMerchantName(input.merchantName);

  // Layer 1: exact matching
  const layer1Result = matchLayer1Exact(
    normalized,
    input.merchantName,
    apps,
    catalogs
  );
  if (layer1Result) {
    return layer1Result;
  }

  // Layer 2: partial matching
  const layer2Result = matchLayer2Partial(normalized, apps, catalogs);
  if (layer2Result) {
    return layer2Result;
  }

  // Layer 3: fuzzy matching
  const layer3Result = matchLayer3Fuzzy(
    normalized,
    apps,
    catalogs,
    fuzzyThreshold
  );
  if (layer3Result) {
    return layer3Result;
  }

  // No match (Layer 4 LLM is called separately)
  return {
    appId: null,
    appName: null,
    confidence: 0,
    matchSource: null,
    matchLayer: null,
    normalized,
  };
}
