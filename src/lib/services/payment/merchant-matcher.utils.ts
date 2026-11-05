// src/lib/services/payment/merchant-matcher.utils.ts
import {
  BUSINESS_SUFFIXES,
  COUNTRY_CODES,
  PAYMENT_PREFIXES,
} from "./merchant-matcher.constants";

/**
 * Normalises a merchant name
 */
export function normalizeMerchantName(merchantName: string): string {
  let normalized = merchantName.toUpperCase().trim();

  // Remove payment processor prefixes
  for (const prefix of PAYMENT_PREFIXES) {
    if (normalized.startsWith(prefix.toUpperCase())) {
      normalized = normalized.substring(prefix.length);
      break;
    }
  }

  // Remove special characters (*, ., -, etc.)
  normalized = normalized.replace(/[*.,\-_#@!$%^&()[\]{}'"]/g, " ");

  // Collapse consecutive whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Remove country codes (at the end of a word)
  const words = normalized.split(" ");
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (COUNTRY_CODES.includes(lastWord)) {
      words.pop();
      normalized = words.join(" ");
    }
  }

  // Remove business entity suffixes
  for (const suffix of BUSINESS_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix.toUpperCase()}\\b`, "g");
    normalized = normalized.replace(regex, "");
  }

  // Collapse whitespace again
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Calculates the similarity of two strings (Levenshtein distance)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  // Check whether the shorter string is contained in the longer one
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = Math.min(len1, len2);
    const longer = Math.max(len1, len2);
    return shorter / longer;
  }

  // Levenshtein distance
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[len1][len2];
  const maxLen = Math.max(len1, len2);

  return 1 - distance / maxLen;
}

/**
 * Calculates match confidence
 */
export function calculateMatchConfidence(
  merchantName: string,
  targetName: string
): number {
  const normalized1 = normalizeMerchantName(merchantName);
  const normalized2 = normalizeMerchantName(targetName);

  // Exact match after normalisation
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Exact match on the original
  if (merchantName.toUpperCase() === targetName.toUpperCase()) {
    return 1.0;
  }

  // Calculate similarity
  const similarity = calculateSimilarity(normalized1, normalized2);

  // Check containment
  const n1Lower = normalized1.toLowerCase();
  const n2Lower = normalized2.toLowerCase();

  if (n1Lower.includes(n2Lower) || n2Lower.includes(n1Lower)) {
    const shorter = Math.min(normalized1.length, normalized2.length);
    const longer = Math.max(normalized1.length, normalized2.length);
    const containmentRatio = shorter / longer;
    return Math.max(similarity, containmentRatio * 0.95);
  }

  return similarity;
}
