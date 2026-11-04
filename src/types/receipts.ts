// src/types/receipts.ts
/**
 * Shared types for the Email Receipt Detection area (Gmail + Outlook).
 */
import type {
  BillingCycle,
  MailboxProvider as MailboxProviderId,
  MailboxStatus,
  ReceiptSuggestionStatus,
} from "@prisma/client";

export type { MailboxProviderId, MailboxStatus, ReceiptSuggestionStatus };

/** Provider-agnostic message shape handed to the parser. */
export interface RawMessage {
  id: string;
  threadId?: string;
  /** Raw `From` header, e.g. `"Notion Team" <team@makenotion.com>` */
  from: string;
  subject: string;
  /** ISO-8601 or RFC-2822 date string */
  date: string;
  snippet: string;
  bodyText: string;
  bodyHtml?: string;
}

/** OAuth token set stored (encrypted) on `MailboxConnection`. */
export interface MailboxTokens {
  accessToken: string;
  refreshToken?: string | null;
  /** Epoch milliseconds */
  expiresAt?: number | null;
  /** Space-separated granted scopes (informational) */
  scope?: string | null;
}

export interface ListCandidateOptions {
  /** Only messages received at/after this instant */
  since: Date;
  /** Provider cursor from the previous run (Gmail historyId / Graph delta link) */
  cursor?: string | null;
  maxResults: number;
}

export interface ListCandidateResult {
  messages: RawMessage[];
  nextCursor: string | null;
}

export interface MailboxProfile {
  email: string;
  /** Initial cursor to persist after the first connection */
  cursor?: string | null;
}

/** Signals the deterministic parser found; each contributes to confidence. */
export interface ReceiptSignals {
  hasReceiptKeyword: boolean;
  hasAmount: boolean;
  hasCurrency: boolean;
  hasBillingCycle: boolean;
  hasNextRenewal: boolean;
  hasVendor: boolean;
  hasSubscriptionWording: boolean;
  isTrial: boolean;
  looksLikeOneOffOrder: boolean;
  looksLikeShipping: boolean;
  looksLikeMarketing: boolean;
}

export interface ParsedReceipt {
  vendorName: string | null;
  vendorDomain: string | null;
  /** SaaSCatalog id when the vendor matched a catalog name/alias/website */
  catalogId: string | null;
  senderEmail: string | null;
  amount: number | null;
  currency: string | null;
  billingCycle: BillingCycle | null;
  chargedAt: Date | null;
  nextRenewalAt: Date | null;
  isTrial: boolean;
  /** 0–1 */
  confidence: number;
  signals: ReceiptSignals;
}

/** Row shape served to the review queue and the mobile API. */
export interface ReceiptSuggestionDTO {
  id: string;
  mailboxId: string;
  mailboxEmail: string;
  provider: MailboxProviderId;
  messageId: string;
  vendorName: string;
  senderEmail: string | null;
  subject: string | null;
  amount: number | null;
  currency: string | null;
  billingCycle: BillingCycle | null;
  chargedAt: string | null;
  nextRenewalAt: string | null;
  confidence: number;
  snippet: string | null;
  status: ReceiptSuggestionStatus;
  matchedCatalog: {
    id: string;
    name: string;
    logoUrl: string | null;
    category: string;
    website: string | null;
  } | null;
  matchedSubscription: {
    id: string;
    appName: string;
    amount: number;
    currency: string;
  } | null;
  createdAt: string;
}

export interface MailboxConnectionDTO {
  id: string;
  provider: MailboxProviderId;
  email: string;
  status: MailboxStatus;
  lastScannedAt: string | null;
  errorMessage: string | null;
  suggestionCount: number;
  newSuggestionCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
  isOwn: boolean;
  createdAt: string;
}

export interface MailboxProviderAvailability {
  gmail: boolean;
  outlook: boolean;
}

export interface ScanMailboxResult {
  connectionId: string;
  fetched: number;
  parsed: number;
  belowThreshold: number;
  created: number;
  updated: number;
  duplicates: number;
  priceChanges: number;
  error?: string;
}

export interface LinkableSubscriptionDTO {
  id: string;
  appName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
}
