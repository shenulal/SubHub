// src/lib/services/saas-classifier.types.ts
/**
 * SaaS classifier types
 */

export interface SaaSInferenceInput {
  merchantName: string;
  memo?: string | null;
  storeBizNo?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export interface SaaSInferenceResult {
  isSaaS: boolean;
  canonicalName: string | null;
  website: string | null;
  category: string | null;
  confidence: number;
  suggestedPatterns: string[];
  reasoning?: string;
  /** SMP-160: Pricing model detected by LLM */
  pricingModel?: "PER_SEAT" | "FLAT_RATE" | "USAGE_BASED" | null;
}

export interface SaaSInferenceUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface SaaSInferencePayload {
  inference: SaaSInferenceResult | null;
  usage?: SaaSInferenceUsage;
  errorCode?: string;
}

// Batch processing types
export interface BatchMerchantInput {
  id: string; // Transaction identifier (apprNo, etc.)
  merchantName: string;
  memo?: string | null;
  amount?: number | null;
  recurrenceHint?: string | null;
}

export interface BatchInferenceResult {
  id: string;
  inference: SaaSInferenceResult | null;
}

export interface BatchInferencePayload {
  results: BatchInferenceResult[];
  usage?: SaaSInferenceUsage;
  errorCode?: string;
}
