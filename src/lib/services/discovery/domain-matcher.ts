// src/lib/services/discovery/domain-matcher.ts
/**
 * Domain-to-app matching service
 * Matches login domains captured by the browser extension to registered apps
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  extractDomainBase,
  extractMainDomain,
} from "@/lib/utils/domain-extractor";

export interface DomainMatchResult {
  appId: string;
  appName: string;
  confidence: number;
  matchTier: "CUSTOM_WEBSITE" | "CATALOG_WEBSITE" | "SAAS_PATTERN";
}

/**
 * Matches a domain to an app registered in the organization
 *
 * Three-tier matching algorithm:
 * 1. Tier 1 (confidence 1.0): exact domain match on App.customWebsite
 * 2. Tier 2 (confidence 0.95): match via SaaSCatalog.website → App.catalogId
 * 3. Tier 3 (confidence = pattern.confidence): SaaSPattern (DOMAIN) pattern match
 */
export async function matchDomainToApp(
  domain: string,
  organizationId: string
): Promise<DomainMatchResult | null> {
  const normalizedDomain = domain.toLowerCase().trim();
  const mainDomain = extractMainDomain(normalizedDomain);

  if (!mainDomain) {
    logger.debug({ domain }, "Invalid domain for matching");
    return null;
  }

  const domainBase = extractDomainBase(mainDomain);

  // Tier 1: exact domain match on App.customWebsite
  const tier1Result = await matchByCustomWebsite(
    mainDomain,
    domainBase,
    organizationId
  );
  if (tier1Result) return tier1Result;

  // Tier 2: match via SaaSCatalog.website → App.catalogId
  const tier2Result = await matchByCatalogWebsite(
    mainDomain,
    domainBase,
    organizationId
  );
  if (tier2Result) return tier2Result;

  // Tier 3: SaaSPattern (DOMAIN) pattern match
  const tier3Result = await matchBySaaSPattern(
    mainDomain,
    domainBase,
    organizationId
  );
  if (tier3Result) return tier3Result;

  logger.debug({ domain, mainDomain }, "No app match found for domain");
  return null;
}

/**
 * Tier 1: App.customWebsite domain match
 * confidence: 1.0
 */
async function matchByCustomWebsite(
  mainDomain: string,
  domainBase: string,
  organizationId: string
): Promise<DomainMatchResult | null> {
  const apps = await prisma.app.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      customWebsite: { not: null },
    },
    select: {
      id: true,
      name: true,
      customWebsite: true,
    },
  });

  for (const app of apps) {
    if (!app.customWebsite) continue;

    const appDomain = extractMainDomain(app.customWebsite);
    if (!appDomain) continue;

    // Exact domain match
    if (appDomain === mainDomain) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: 1.0,
        matchTier: "CUSTOM_WEBSITE",
      };
    }

    // TLD variant match (atlassian.net vs atlassian.com)
    const appBase = extractDomainBase(appDomain);
    if (appBase === domainBase && appBase.length > 2) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: 1.0,
        matchTier: "CUSTOM_WEBSITE",
      };
    }
  }

  return null;
}

/**
 * Tier 2: SaaSCatalog.website → App.catalogId match
 * confidence: 0.95
 */
async function matchByCatalogWebsite(
  mainDomain: string,
  domainBase: string,
  organizationId: string
): Promise<DomainMatchResult | null> {
  const apps = await prisma.app.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      catalogId: { not: null },
    },
    select: {
      id: true,
      name: true,
      catalog: {
        select: {
          website: true,
        },
      },
    },
  });

  for (const app of apps) {
    const catalogWebsite = app.catalog?.website;
    if (!catalogWebsite) continue;

    const catalogDomain = extractMainDomain(catalogWebsite);
    if (!catalogDomain) continue;

    // Exact domain match
    if (catalogDomain === mainDomain) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: 0.95,
        matchTier: "CATALOG_WEBSITE",
      };
    }

    // TLD variant match
    const catalogBase = extractDomainBase(catalogDomain);
    if (catalogBase === domainBase && catalogBase.length > 2) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: 0.95,
        matchTier: "CATALOG_WEBSITE",
      };
    }
  }

  return null;
}

/**
 * Tier 3: SaaSPattern (DOMAIN) pattern match
 * confidence: pattern.confidence
 */
async function matchBySaaSPattern(
  mainDomain: string,
  domainBase: string,
  organizationId: string
): Promise<DomainMatchResult | null> {
  // Load DOMAIN-type patterns
  const patterns = await prisma.saaSPattern.findMany({
    where: {
      matchType: "DOMAIN",
    },
    select: {
      pattern: true,
      confidence: true,
      catalogId: true,
    },
  });

  for (const pattern of patterns) {
    const patternDomain = pattern.pattern.toLowerCase().replace(/^\*\./, "");
    const patternBase = extractDomainBase(patternDomain);

    const isMatch =
      patternDomain === mainDomain ||
      (patternBase === domainBase && patternBase.length > 2);

    if (!isMatch) continue;

    // Find the organization's ACTIVE app that uses this catalog entry
    const app = await prisma.app.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        catalogId: pattern.catalogId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (app) {
      return {
        appId: app.id,
        appName: app.name,
        confidence: pattern.confidence,
        matchTier: "SAAS_PATTERN",
      };
    }
  }

  return null;
}
