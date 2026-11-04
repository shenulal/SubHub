// src/lib/services/receipts/parser.cycle.ts
/**
 * Billing-cycle, date and trial detection.
 */
import type { BillingCycle } from "@prisma/client";
import { MONTHS, TRIAL_WORDING } from "./parser.constants";

const CYCLE_PATTERNS: Array<{ cycle: BillingCycle; pattern: RegExp }> = [
  {
    cycle: "YEARLY",
    pattern:
      /\b(?:annual(?:ly)?|yearly|per\s+year|each\s+year|every\s+year|a\s+year|12\s+months|1\s+year)\b|\/\s?(?:yr|year)\b/gi,
  },
  {
    cycle: "QUARTERLY",
    pattern:
      /\b(?:quarterly|per\s+quarter|every\s+3\s+months|every\s+three\s+months|3\s+months)\b|\/\s?(?:qtr|quarter)\b/gi,
  },
  {
    cycle: "MONTHLY",
    pattern:
      /\b(?:monthly|per\s+month|each\s+month|every\s+month|a\s+month|1\s+month|30\s+days)\b|\/\s?(?:mo|month)\b/gi,
  },
  {
    cycle: "ONE_TIME",
    pattern: /\b(?:one[-\s]?time|single\s+payment|lifetime|one[-\s]?off)\b/gi,
  },
];

const MONTH_NAMES = Object.keys(MONTHS).join("|");
const DATE_PATTERNS: RegExp[] = [
  // 2026-01-05 / 2026/01/05
  /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/,
  // Jan 5, 2026 / January 05 2026
  new RegExp(
    String.raw`\b(${MONTH_NAMES})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`,
    "i"
  ),
  // 5 Jan 2026 / 05 January, 2026
  new RegExp(
    String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_NAMES})\.?,?\s+(\d{4})\b`,
    "i"
  ),
  // 01/05/2026 (US) or 05.01.2026 (EU)
  /\b(\d{1,2})([./])(\d{1,2})\2(\d{4})\b/,
];

// Captures run to end of line (dates may contain dots: 05.05.2027); parseDateToken
// then picks the first date inside the capture.
const NEXT_RENEWAL_PATTERNS: RegExp[] = [
  /next\s+(?:billing|payment|renewal|charge|invoice)\s+(?:date|is|on|will\s+be|will\s+occur|scheduled)?[:\s]*(?:on\s+)?([^\n]{4,40})/i,
  /(?:renews?|will\s+renew|auto-?renews?|renewal\s+date|renewal\s+is)\s*(?:on|:|automatically\s+on)?\s*([^\n]{4,40})/i,
  /(?:billing\s+period|service\s+period|subscription\s+period)[:\s]*[^\n]*?(?:-|–|to|through)\s*([^\n]{4,40})/i,
  /(?:valid|active)\s+(?:until|through|till)\s*([^\n]{4,40})/i,
  /(?:your\s+)?next\s+bill\s+(?:is\s+)?(?:due\s+)?(?:on\s+)?([^\n]{4,40})/i,
];

const CHARGE_DATE_PATTERNS: RegExp[] = [
  /(?<!next\s)(?:payment|charge|transaction|invoice|receipt|billing)\s+date[:\s]+([^\n]{4,40})/i,
  /(?<!next\s)(?:date\s+)?(?:charged|paid|billed)(?:\s+on)?[:\s]+([^\n]{4,40})/i,
  /^\s*date[:\s]+([^\n]{4,40})/im,
];

function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCMonth() === month ? date : null;
}

/** Parse the first recognisable date inside `text`. */
export function parseDateToken(text: string): Date | null {
  const iso = DATE_PATTERNS[0].exec(text);
  if (iso) return buildDate(+iso[1], +iso[2] - 1, +iso[3]);

  const mdy = DATE_PATTERNS[1].exec(text);
  if (mdy) return buildDate(+mdy[3], MONTHS[mdy[1].toLowerCase()], +mdy[2]);

  const dmy = DATE_PATTERNS[2].exec(text);
  if (dmy) return buildDate(+dmy[3], MONTHS[dmy[2].toLowerCase()], +dmy[1]);

  const numeric = DATE_PATTERNS[3].exec(text);
  if (numeric) {
    const a = +numeric[1];
    const b = +numeric[3];
    const year = +numeric[4];
    // Dotted form is European (DD.MM); slashed defaults to US (MM/DD) unless impossible.
    const dayFirst = numeric[2] === "." || a > 12;
    return dayFirst ? buildDate(year, b - 1, a) : buildDate(year, a - 1, b);
  }
  return null;
}

/** "billed monthly" is an explicit statement and outranks incidental mentions. */
const BILLED_PATTERNS: Partial<Record<BillingCycle, RegExp>> = {
  YEARLY: /\b(?:billed|charged|paid)\s+(?:annually|yearly)\b/i,
  QUARTERLY: /\b(?:billed|charged|paid)\s+quarterly\b/i,
  MONTHLY: /\b(?:billed|charged|paid)\s+monthly\b/i,
};
const BILLED_BONUS = 2;

export function detectBillingCycle(text: string): BillingCycle | null {
  let best: { cycle: BillingCycle; count: number; first: number } | null = null;
  for (const { cycle, pattern } of CYCLE_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length === 0) continue;
    const first = matches[0].index ?? Number.MAX_SAFE_INTEGER;
    const bonus = BILLED_PATTERNS[cycle]?.test(text) ? BILLED_BONUS : 0;
    const candidate = { cycle, count: matches.length + bonus, first };
    if (
      !best ||
      candidate.count > best.count ||
      (candidate.count === best.count && candidate.first < best.first)
    ) {
      best = candidate;
    }
  }
  // "one-time" only wins when no recurring wording is present at all.
  if (best?.cycle === "ONE_TIME") {
    const recurring = CYCLE_PATTERNS.filter((p) => p.cycle !== "ONE_TIME").some(
      (p) => new RegExp(p.pattern.source, "i").test(text)
    );
    return recurring ? null : "ONE_TIME";
  }
  return best?.cycle ?? null;
}

export function detectNextRenewal(text: string): Date | null {
  for (const pattern of NEXT_RENEWAL_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const date = parseDateToken(match[1]);
    if (date) return date;
  }
  return null;
}

export function detectChargeDate(text: string, fallback: string): Date | null {
  for (const pattern of CHARGE_DATE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const date = parseDateToken(match[1]);
    if (date) return date;
  }
  const parsed = new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function detectTrial(text: string): boolean {
  const lower = text.toLowerCase();
  return TRIAL_WORDING.some((word) => lower.includes(word));
}

const CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
  ONE_TIME: 0,
};

/** chargedAt + one billing cycle (used only when no explicit renewal date exists). */
export function deriveNextRenewal(
  chargedAt: Date,
  cycle: BillingCycle
): Date | null {
  const months = CYCLE_MONTHS[cycle];
  if (!months) return null;
  const next = new Date(chargedAt.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
