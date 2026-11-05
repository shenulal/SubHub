// src/lib/services/saas-classifier.constants.ts
/**
 * SaaS classifier constants
 * SMP-196: migrated to the Vercel AI SDK — single ANTHROPIC_API_KEY
 */

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
// Legacy URL constants kept for reference but no longer used directly
// (Vercel AI SDK handles API routing internally)
export const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
export const BATCH_SIZE = 15;
export const FAILURE_TTL_MS = 5 * 60 * 1000; // Skip retrying the same failure for 5 minutes
export const FAILURE_CACHE_CODES = new Set([
  "context_length_exceeded",
  "timeout",
  "rate_limit_exceeded",
  "rate_limit",
  "overloaded",
]);
