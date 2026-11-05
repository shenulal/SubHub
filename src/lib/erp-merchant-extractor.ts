// src/lib/erp-merchant-extractor.ts
// Multi-field SaaS name extraction engine
// Intelligently extracts the actual SaaS/service name from ERP data
//
// NOTE: the Korean skip patterns, memo keywords and field names in this file are functional.
// They are matched against account names and memo text in Korean ERP exports and must
// not be translated.

import type { MerchantExtractConfig } from "./erp-format-presets";

/** Default skipPatterns - meaningless vendor names / descriptions */
const DEFAULT_SKIP_PATTERNS: string[] = [
  // Korean (general accounting terms)
  "카드결제",
  "법인카드",
  "미지급금",
  "보통예금",
  "현금",
  "당좌예금",
  "외상매입금",
  "선급금",
  "가지급금",
  "미수금",
  "예수금",
  "부가세",
  "매입세액",
  "원천징수",
  // English (general)
  "CLEARING",
  "PAYMENT",
  "BANK TRANSFER",
  "CASH",
  "PREPAYMENT",
  "ACCRUAL",
  "REVERSAL",
  "OPENING BALANCE",
  "CLOSING BALANCE",
  // Korean patterns (transfers, payroll)
  "계좌이체",
  "자동이체",
  "급여",
  "상여",
  "퇴직",
];

/**
 * Check whether a value matches a skipPattern
 * Case-insensitive, partial match
 */
function shouldSkip(value: string, skipPatterns: string[]): boolean {
  if (!value || !value.trim()) return true;

  const lower = value.toLowerCase().trim();

  // Skip values that are too short (1 character or less)
  if (lower.length <= 1) return true;

  // Skip values made up of digits only
  if (/^\d+$/.test(lower)) return true;

  for (const pattern of skipPatterns) {
    if (lower === pattern.toLowerCase()) return true;
    if (lower.includes(pattern.toLowerCase())) return true;
  }

  return false;
}

/**
 * Advanced logic to extract the SaaS name from a memo (description)
 *
 * Example patterns (Korean memo text, shown here in English):
 * - "March Slack subscription fee" → "Slack"
 * - "Notion team plan payment" → "Notion"
 * - "AWS server cost for April" → "AWS"
 * - "GitHub Enterprise licence" → "GitHub Enterprise"
 */
function extractFromMemo(memo: string): string | null {
  if (!memo || !memo.trim()) return null;

  const cleaned = memo.trim();

  // Pattern 1: "<N> month {SaaS name} {description}" (Korean month/keyword suffixes are functional)
  const monthPattern = cleaned.match(
    /\d{1,2}월\s+([A-Za-z][A-Za-z0-9\s.]+?)(?:\s+(?:구독|결제|라이[선센]스|비용|사용|이용|요금|플랜))/
  );
  if (monthPattern) return monthPattern[1].trim();

  // Pattern 2: "{SaaS name} {description}" (starts with English; Korean keywords are functional)
  const englishStartPattern = cleaned.match(
    /^([A-Za-z][A-Za-z0-9\s.]{1,30}?)(?:\s+(?:구독|결제|라이[선센]스|비용|사용|이용|요금|플랜|서비스|월|년|연))/
  );
  if (englishStartPattern) return englishStartPattern[1].trim();

  // Pattern 3: the whole memo is English (likely the SaaS name itself)
  if (/^[A-Za-z][A-Za-z0-9\s.]+$/.test(cleaned) && cleaned.length <= 50) {
    return cleaned;
  }

  return null;
}

/**
 * Extract the merchantName (SaaS name) from a CSV row
 *
 * @param row - CSV row data
 * @param config - MerchantExtractConfig (taken from the preset)
 * @returns The extracted SaaS name, or null
 */
export function extractMerchantName(
  row: Record<string, string>,
  config: MerchantExtractConfig
): string | null {
  const allSkipPatterns = [...config.skipPatterns, ...DEFAULT_SKIP_PATTERNS];
  // Remove duplicates
  const uniqueSkipPatterns = [...new Set(allSkipPatterns)];

  // Try fields in priority order
  for (const fieldName of config.fieldPriority) {
    // Match fields case-insensitively
    const matchedKey = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === fieldName.toLowerCase().trim()
    );

    if (!matchedKey) continue;

    const value = row[matchedKey];
    if (!value || !value.trim()) continue;

    // Move to the next field when a skip pattern matches
    if (shouldSkip(value, uniqueSkipPatterns)) continue;

    // For memo fields, try advanced extraction (Korean memo column names are functional)
    const isMemoField = [
      "적요",
      "메모",
      "비고",
      "memo",
      "description",
      "documentitemtext",
    ].includes(fieldName.toLowerCase());

    if (isMemoField) {
      const extracted = extractFromMemo(value);
      if (extracted && !shouldSkip(extracted, uniqueSkipPatterns)) {
        return extracted;
      }
      // If extraction from the memo fails, move to the next field
      continue;
    }

    // Regular field: return the value as-is
    return value.trim();
  }

  // If every field fails, fall back to the first non-skip value
  for (const fieldName of config.fieldPriority) {
    const matchedKey = Object.keys(row).find(
      (k) => k.toLowerCase().trim() === fieldName.toLowerCase().trim()
    );
    if (!matchedKey) continue;
    const value = row[matchedKey]?.trim();
    if (value && value.length > 1) {
      return value;
    }
  }

  return null;
}

/**
 * Batch extraction: extract merchantName from multiple rows
 */
export function extractMerchantNames(
  rows: Record<string, string>[],
  config: MerchantExtractConfig
): (string | null)[] {
  return rows.map((row) => extractMerchantName(row, config));
}
