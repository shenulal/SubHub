// src/lib/services/receipts/tokens.ts
/**
 * Token storage helpers: OAuth tokens are AES-256-GCM encrypted at rest with
 * the platform ENCRYPTION_KEY (see `@/lib/crypto`).
 */
import { decrypt, encrypt } from "@/lib/crypto";
import type { MailboxTokens } from "@/types/receipts";

export interface StoredTokenColumns {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/** Refresh when the token expires within this window (protocol constant). */
export const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

export function encryptTokens(tokens: MailboxTokens): StoredTokenColumns {
  return {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
  };
}

export function decryptTokens(columns: StoredTokenColumns): MailboxTokens {
  return {
    accessToken: decrypt(columns.accessToken),
    refreshToken: columns.refreshToken ? decrypt(columns.refreshToken) : null,
    expiresAt: columns.expiresAt ? columns.expiresAt.getTime() : null,
  };
}

export function isExpiringSoon(
  tokens: MailboxTokens,
  now: number = Date.now(),
  skewMs: number = TOKEN_REFRESH_SKEW_MS
): boolean {
  if (!tokens.expiresAt) return false;
  return tokens.expiresAt - now < skewMs;
}
