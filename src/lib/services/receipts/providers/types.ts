// src/lib/services/receipts/providers/types.ts
/**
 * Provider abstraction for read-only mailbox access (Gmail, Outlook).
 */
import type {
  ListCandidateOptions,
  ListCandidateResult,
  MailboxProfile,
  MailboxProviderAvailability,
  MailboxProviderId,
  MailboxTokens,
  RawMessage,
} from "@/types/receipts";

export interface MailboxProvider {
  readonly id: MailboxProviderId;
  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<MailboxTokens>;
  refresh(tokens: MailboxTokens): Promise<MailboxTokens>;
  getProfile(tokens: MailboxTokens): Promise<MailboxProfile>;
  listCandidateMessages(
    tokens: MailboxTokens,
    options: ListCandidateOptions
  ): Promise<ListCandidateResult>;
  getMessage(tokens: MailboxTokens, id: string): Promise<RawMessage | null>;
  /** Best-effort token revocation on disconnect. */
  revoke(tokens: MailboxTokens): Promise<void>;
}

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

export class MailboxProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_CONFIGURED"
      | "AUTH"
      | "CURSOR_EXPIRED"
      | "RATE_LIMIT"
      | "UPSTREAM"
  ) {
    super(message);
    this.name = "MailboxProviderError";
  }
}

function read(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Gmail credentials: dedicated vars first, then the NextAuth Google app. */
export function getGmailCredentials(): OAuthClientCredentials | null {
  const clientId = read("GMAIL_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const clientSecret = read("GMAIL_CLIENT_SECRET", "GOOGLE_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getOutlookCredentials(): OAuthClientCredentials | null {
  const clientId = read("MS_GRAPH_CLIENT_ID");
  const clientSecret = read("MS_GRAPH_CLIENT_SECRET");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getProviderAvailability(): MailboxProviderAvailability {
  return {
    gmail: getGmailCredentials() !== null,
    outlook: getOutlookCredentials() !== null,
  };
}

export function requireCredentials(
  provider: MailboxProviderId
): OAuthClientCredentials {
  const creds =
    provider === "GMAIL" ? getGmailCredentials() : getOutlookCredentials();
  if (!creds) {
    throw new MailboxProviderError(
      `${provider} OAuth client is not configured`,
      "NOT_CONFIGURED"
    );
  }
  return creds;
}

/** Words that make a message worth parsing (cheap pre-filter before the parser). */
const CANDIDATE_WORDS = [
  "receipt",
  "invoice",
  "payment",
  "subscription",
  "renew",
  "billing",
  "billed",
  "charged",
  "statement",
  "membership",
  "trial",
  "plan",
] as const;

/** Keyword query used by providers that support server-side search. */
export const CANDIDATE_SEARCH_TERMS = [
  "receipt",
  "invoice",
  '"your subscription"',
  '"payment received"',
  '"payment confirmation"',
  "renewal",
  "renewed",
  '"billing statement"',
] as const;

export function looksLikeReceiptCandidate(
  subject: string | null | undefined,
  preview: string | null | undefined
): boolean {
  const text = `${subject ?? ""} ${preview ?? ""}`.toLowerCase();
  return CANDIDATE_WORDS.some((word) => text.includes(word));
}

export function toIsoDate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
