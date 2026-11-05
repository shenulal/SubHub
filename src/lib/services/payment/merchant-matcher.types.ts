// src/lib/services/payment/merchant-matcher.types.ts
import type { MatchSource } from "@prisma/client";

// Catalog pattern type
export interface CatalogPattern {
  pattern: string;
  matchType: "EXACT" | "DOMAIN" | "SUBDOMAIN" | "REGEX";
  confidence: number;
}

// Catalog with patterns type
export interface CatalogWithPatterns {
  id: string;
  name: string;
  slug: string;
  patterns: CatalogPattern[];
}

// App type for matching
export interface AppMatch {
  id: string;
  name: string;
  catalogId: string | null;
}

// Match result type
export interface MerchantMatchResult {
  merchantName: string;
  normalizedName: string;
  appId: string;
  appName: string;
  catalogId?: string;
  confidence: number;
  matchSource: MatchSource;
}

// Catalog match result
export interface CatalogMatchResult {
  catalogId: string;
  catalogName: string;
  confidence: number;
}

// 4-layer matching input
export interface FourLayerMatchInput {
  merchantName: string;
  memo?: string | null;
  storeBizNo?: string | null;
  amount?: number | null;
  currency?: string;
}

// 4-layer matching result
export interface FourLayerMatchResult {
  appId: string | null;
  appName: string | null;
  catalogId?: string;
  confidence: number;
  matchSource: MatchSource | null;
  matchLayer: 1 | 2 | 3 | 4 | null;
  normalized: string;
}
