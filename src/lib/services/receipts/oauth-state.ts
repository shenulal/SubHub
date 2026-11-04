// src/lib/services/receipts/oauth-state.ts
/**
 * Signed OAuth `state` for the mailbox connect flow.
 * payload = base64url(JSON) ; signature = HMAC-SHA256(payload, secret).
 * The nonce is mirrored in an httpOnly cookie so the callback can prove the
 * browser that started the flow is the one finishing it.
 */
import type { MailboxProviderId } from "@/types/receipts";
import crypto from "crypto";

export const OAUTH_STATE_COOKIE = "subhub_mailbox_oauth";
/** Protocol constant (not an organisation tunable): a consent screen rarely takes >10 min. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStatePayload {
  userId: string;
  organizationId: string;
  provider: MailboxProviderId;
  nonce: string;
  issuedAt: number;
}

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!value)
    throw new Error("NEXTAUTH_SECRET is required to sign OAuth state");
  return value;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
}

export function createNonce(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export function signOAuthState(
  input: Omit<OAuthStatePayload, "issuedAt" | "nonce"> & { nonce?: string }
): { state: string; nonce: string } {
  const nonce = input.nonce ?? createNonce();
  const payload: OAuthStatePayload = { ...input, nonce, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { state: `${encoded}.${sign(encoded)}`, nonce };
}

export type OAuthStateFailure =
  | "MALFORMED"
  | "BAD_SIGNATURE"
  | "EXPIRED"
  | "NONCE_MISMATCH";

export function verifyOAuthState(
  state: string | null | undefined,
  cookieNonce: string | null | undefined,
  now: number = Date.now()
):
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; reason: OAuthStateFailure } {
  if (!state || !state.includes(".")) return { ok: false, reason: "MALFORMED" };
  const [encoded, signature] = state.split(".");
  const expected = sign(encoded);
  const a = Buffer.from(signature ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (
    !payload?.userId ||
    !payload.organizationId ||
    !payload.provider ||
    !payload.nonce ||
    typeof payload.issuedAt !== "number"
  ) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (
    now - payload.issuedAt > OAUTH_STATE_TTL_MS ||
    payload.issuedAt > now + 60_000
  ) {
    return { ok: false, reason: "EXPIRED" };
  }
  if (!cookieNonce || cookieNonce !== payload.nonce) {
    return { ok: false, reason: "NONCE_MISMATCH" };
  }
  return { ok: true, payload };
}
