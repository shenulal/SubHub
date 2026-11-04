// src/lib/services/receipts/parser.ts
/**
 * Deterministic receipt parser: RawMessage → ParsedReceipt.
 * No network, no LLM. Every signal is explainable and unit-tested.
 */
import type {
  ParsedReceipt,
  RawMessage,
  ReceiptSignals,
} from "@/types/receipts";
import { extractAmount } from "./parser.amount";
import {
  CONFIDENCE_WEIGHTS,
  MARKETING_WORDING,
  ONE_OFF_WORDING,
  RECEIPT_KEYWORDS,
  SHIPPING_WORDING,
  SUBSCRIPTION_WORDING,
} from "./parser.constants";
import {
  deriveNextRenewal,
  detectBillingCycle,
  detectChargeDate,
  detectNextRenewal,
  detectTrial,
} from "./parser.cycle";
import { extractVendor, parseSender, type KnownVendor } from "./parser.vendor";

export type { KnownVendor } from "./parser.vendor";

export interface ParseOptions {
  /** Catalog entries used for alias matching (name, aliases, website). */
  knownVendors?: KnownVendor[];
}

const MAX_BODY_CHARS = 20_000;

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/** Strip tags/entities from HTML so regexes see plain text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(?:p|div|tr|li|h[1-6]|table|br)\s*>|<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, " \t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(+code))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function bodyOf(message: RawMessage): string {
  const text = message.bodyText?.trim()
    ? message.bodyText
    : message.bodyHtml
      ? htmlToText(message.bodyHtml)
      : message.snippet;
  return text.slice(0, MAX_BODY_CHARS);
}

function scoreSignals(
  signals: ReceiptSignals,
  subjectHasKeyword: boolean,
  knownVendor: boolean
): number {
  const w = CONFIDENCE_WEIGHTS;
  let score = 0;
  if (subjectHasKeyword) score += w.receiptKeywordInSubject;
  else if (signals.hasReceiptKeyword) score += w.receiptKeywordInBody;
  if (signals.hasAmount) score += w.amount;
  if (signals.hasCurrency) score += w.currency;
  if (signals.hasBillingCycle) score += w.billingCycle;
  if (signals.hasNextRenewal) score += w.nextRenewal;
  if (signals.hasSubscriptionWording) score += w.subscriptionWording;
  if (signals.hasVendor) score += w.vendor;
  if (knownVendor) score += w.knownVendor;
  if (signals.looksLikeOneOffOrder) score += w.oneOffPenalty;
  if (signals.looksLikeShipping) score += w.shippingPenalty;
  if (signals.looksLikeMarketing) score += w.marketingPenalty;
  if (!signals.hasAmount && !signals.hasReceiptKeyword)
    score = Math.min(score, w.weakSignalCap);
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

export function parseReceipt(
  message: RawMessage,
  options: ParseOptions = {}
): ParsedReceipt {
  const subject = message.subject ?? "";
  const body = bodyOf(message);
  const combined = `${subject}\n${body}`;
  const lower = combined.toLowerCase();
  const subjectLower = subject.toLowerCase();

  const vendor = extractVendor(message.from, subject, options.knownVendors);
  const sender = parseSender(message.from);
  const money = extractAmount(combined);
  const billingCycle = detectBillingCycle(combined);
  const chargedAt = detectChargeDate(body, message.date);
  const explicitRenewal = detectNextRenewal(combined);
  const nextRenewalAt =
    explicitRenewal ??
    (chargedAt && billingCycle
      ? deriveNextRenewal(chargedAt, billingCycle)
      : null);

  const subjectHasKeyword = containsAny(subjectLower, RECEIPT_KEYWORDS);
  const signals: ReceiptSignals = {
    hasReceiptKeyword:
      subjectHasKeyword || containsAny(lower, RECEIPT_KEYWORDS),
    hasAmount: money !== null,
    hasCurrency: money !== null && !!money.currency,
    hasBillingCycle: billingCycle !== null && billingCycle !== "ONE_TIME",
    hasNextRenewal: explicitRenewal !== null,
    hasVendor: vendor.name !== null,
    hasSubscriptionWording: containsAny(lower, SUBSCRIPTION_WORDING),
    isTrial: detectTrial(combined),
    looksLikeOneOffOrder:
      containsAny(lower, ONE_OFF_WORDING) || billingCycle === "ONE_TIME",
    looksLikeShipping: containsAny(subjectLower, SHIPPING_WORDING),
    looksLikeMarketing: containsAny(lower, MARKETING_WORDING),
  };

  return {
    vendorName: vendor.name,
    vendorDomain: vendor.domain,
    catalogId: vendor.knownVendorId,
    senderEmail: sender.email,
    amount: money?.amount ?? null,
    currency: money?.currency ?? null,
    billingCycle,
    chargedAt,
    nextRenewalAt,
    isTrial: signals.isTrial,
    confidence: scoreSignals(
      signals,
      subjectHasKeyword,
      vendor.knownVendorId !== null
    ),
    signals,
  };
}
