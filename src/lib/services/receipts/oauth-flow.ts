// src/lib/services/receipts/oauth-flow.ts
/**
 * Connect / callback orchestration for mailbox OAuth (shared by the route
 * handlers so the logic is unit-testable without Next request plumbing).
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { MailboxProviderId } from "@/types/receipts";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state";
import { getProvider } from "./providers";
import { encryptTokens } from "./tokens";

export const MAILBOX_SETTINGS_PATH = "/settings/mailboxes";

export type CallbackErrorCode =
  | "denied"
  | "invalid_state"
  | "session_mismatch"
  | "missing_code"
  | "exchange_failed";

export function buildRedirectUri(
  provider: MailboxProviderId,
  requestOrigin: string
): string {
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    requestOrigin;
  return `${base}/api/integrations/mailbox/${provider.toLowerCase()}/callback`;
}

export function stateCookieOptions() {
  return {
    name: OAUTH_STATE_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/mailbox",
    maxAge: Math.floor(OAUTH_STATE_TTL_MS / 1000),
  };
}

export function settingsRedirect(
  origin: string,
  query: { connected?: string; error?: CallbackErrorCode }
): string {
  const url = new URL(MAILBOX_SETTINGS_PATH, origin);
  if (query.connected) url.searchParams.set("connected", query.connected);
  if (query.error) url.searchParams.set("error", query.error);
  return url.toString();
}

export function beginConnect(input: {
  provider: MailboxProviderId;
  userId: string;
  organizationId: string;
  redirectUri: string;
}): { authUrl: string; nonce: string } {
  const { state, nonce } = signOAuthState({
    userId: input.userId,
    organizationId: input.organizationId,
    provider: input.provider,
  });
  const authUrl = getProvider(input.provider).getAuthUrl(
    state,
    input.redirectUri
  );
  return { authUrl, nonce };
}

export interface CallbackInput {
  provider: MailboxProviderId;
  code: string | null;
  state: string | null;
  providerError: string | null;
  cookieNonce: string | null;
  session: { userId: string; organizationId: string };
  redirectUri: string;
}

export type CallbackOutcome =
  | { ok: true; connectionId: string; email: string }
  | { ok: false; error: CallbackErrorCode };

/**
 * Validate state, exchange the code, read the mailbox address and upsert the
 * connection with encrypted tokens.
 */
export async function completeConnect(
  input: CallbackInput
): Promise<CallbackOutcome> {
  if (input.providerError) return { ok: false, error: "denied" };

  const verified = verifyOAuthState(input.state, input.cookieNonce);
  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, "[receipts] OAuth state rejected");
    return { ok: false, error: "invalid_state" };
  }
  const { payload } = verified;
  if (
    payload.userId !== input.session.userId ||
    payload.organizationId !== input.session.organizationId ||
    payload.provider !== input.provider
  ) {
    return { ok: false, error: "session_mismatch" };
  }
  if (!input.code) return { ok: false, error: "missing_code" };

  try {
    const provider = getProvider(input.provider);
    const tokens = await provider.exchangeCode(input.code, input.redirectUri);
    const profile = await provider.getProfile(tokens);
    const columns = encryptTokens(tokens);

    const connection = await prisma.mailboxConnection.upsert({
      where: {
        userId_provider_email: {
          userId: payload.userId,
          provider: input.provider,
          email: profile.email,
        },
      },
      create: {
        organizationId: payload.organizationId,
        userId: payload.userId,
        provider: input.provider,
        email: profile.email,
        ...columns,
        cursor: profile.cursor ?? null,
        status: "ACTIVE",
      },
      update: {
        ...columns,
        organizationId: payload.organizationId,
        cursor: profile.cursor ?? null,
        status: "ACTIVE",
        errorMessage: null,
      },
      select: { id: true, email: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: payload.organizationId,
        userId: payload.userId,
        action: "CONNECT_MAILBOX",
        entityType: "MailboxConnection",
        entityId: connection.id,
        changes: { provider: input.provider, email: profile.email },
      },
    });
    return { ok: true, connectionId: connection.id, email: connection.email };
  } catch (error) {
    logger.error(
      { err: error, provider: input.provider },
      "[receipts] OAuth exchange failed"
    );
    return { ok: false, error: "exchange_failed" };
  }
}
