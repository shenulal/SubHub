// src/lib/services/receipts/oauth-flow.test.ts
import { prisma } from "@/lib/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginConnect,
  buildRedirectUri,
  completeConnect,
  settingsRedirect,
  stateCookieOptions,
} from "./oauth-flow";
import { signOAuthState } from "./oauth-state";
import { getProvider } from "./providers";

vi.mock("@/lib/db", () => ({
  prisma: {
    mailboxConnection: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("./providers", () => ({ getProvider: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const db = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;
const mockedGetProvider = getProvider as unknown as ReturnType<typeof vi.fn>;
const session = { userId: "u1", organizationId: "o1" };

function provider() {
  return {
    getAuthUrl: vi.fn().mockReturnValue("https://consent.example/auth"),
    exchangeCode: vi
      .fn()
      .mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 5000,
      }),
    getProfile: vi
      .fn()
      .mockResolvedValue({ email: "me@acme.com", cursor: "h1" }),
  };
}

describe("oauth-flow", () => {
  const savedUrl = process.env.NEXTAUTH_URL;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "secret";
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    db.mailboxConnection.upsert.mockResolvedValue({
      id: "mb-1",
      email: "me@acme.com",
    });
    db.auditLog.create.mockResolvedValue({});
    mockedGetProvider.mockReturnValue(provider());
  });
  afterEach(() => {
    if (savedUrl) process.env.NEXTAUTH_URL = savedUrl;
  });

  it("builds the redirect uri from NEXTAUTH_URL or the request origin", () => {
    expect(buildRedirectUri("GMAIL", "http://localhost:3000")).toBe(
      "http://localhost:3000/api/integrations/mailbox/gmail/callback"
    );
    process.env.NEXTAUTH_URL = "https://app.subhub.ae/";
    expect(buildRedirectUri("OUTLOOK", "http://localhost:3000")).toBe(
      "https://app.subhub.ae/api/integrations/mailbox/outlook/callback"
    );
  });

  it("builds settings redirects and secure cookie options", () => {
    expect(settingsRedirect("https://x.io", { connected: "1" })).toBe(
      "https://x.io/settings/mailboxes?connected=1"
    );
    expect(settingsRedirect("https://x.io", { error: "denied" })).toBe(
      "https://x.io/settings/mailboxes?error=denied"
    );
    expect(stateCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/api/integrations/mailbox",
      maxAge: 600,
    });
  });

  it("beginConnect signs a state and returns the consent url + nonce", () => {
    const p = provider();
    mockedGetProvider.mockReturnValue(p);
    const { authUrl, nonce } = beginConnect({
      provider: "GMAIL",
      userId: "u1",
      organizationId: "o1",
      redirectUri: "https://x/cb",
    });
    expect(authUrl).toBe("https://consent.example/auth");
    expect(nonce).toHaveLength(22);
    expect(p.getAuthUrl).toHaveBeenCalledWith(
      expect.stringContaining("."),
      "https://x/cb"
    );
  });

  it("rejects provider denial, bad state, cookie mismatch and session mismatch", async () => {
    const base = {
      provider: "GMAIL" as const,
      code: "c",
      providerError: null,
      session,
      redirectUri: "r",
    };
    expect(
      await completeConnect({
        ...base,
        state: "x.y",
        cookieNonce: "n",
        providerError: "access_denied",
      })
    ).toEqual({ ok: false, error: "denied" });
    expect(
      await completeConnect({ ...base, state: "garbage", cookieNonce: "n" })
    ).toEqual({ ok: false, error: "invalid_state" });

    const { state, nonce } = signOAuthState({
      userId: "u1",
      organizationId: "o1",
      provider: "GMAIL",
    });
    expect(
      await completeConnect({ ...base, state, cookieNonce: "other" })
    ).toEqual({ ok: false, error: "invalid_state" });
    expect(
      await completeConnect({
        ...base,
        state,
        cookieNonce: nonce,
        session: { userId: "intruder", organizationId: "o1" },
      })
    ).toEqual({ ok: false, error: "session_mismatch" });
    expect(
      await completeConnect({
        ...base,
        state,
        cookieNonce: nonce,
        provider: "OUTLOOK",
      })
    ).toEqual({ ok: false, error: "session_mismatch" });
    expect(
      await completeConnect({ ...base, state, cookieNonce: nonce, code: null })
    ).toEqual({ ok: false, error: "missing_code" });
    expect(db.mailboxConnection.upsert).not.toHaveBeenCalled();
  });

  it("exchanges the code, upserts the encrypted connection and audits", async () => {
    const { state, nonce } = signOAuthState({
      userId: "u1",
      organizationId: "o1",
      provider: "GMAIL",
    });
    const outcome = await completeConnect({
      provider: "GMAIL",
      code: "code",
      state,
      providerError: null,
      cookieNonce: nonce,
      session,
      redirectUri: "https://x/cb",
    });

    expect(outcome).toEqual({
      ok: true,
      connectionId: "mb-1",
      email: "me@acme.com",
    });
    const args = db.mailboxConnection.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_provider_email: {
        userId: "u1",
        provider: "GMAIL",
        email: "me@acme.com",
      },
    });
    expect(args.create).toMatchObject({
      organizationId: "o1",
      accessToken: "enc:at",
      refreshToken: "enc:rt",
      expiresAt: new Date(5000),
      cursor: "h1",
      status: "ACTIVE",
    });
    expect(args.update).toMatchObject({
      accessToken: "enc:at",
      status: "ACTIVE",
      errorMessage: null,
    });
    expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "CONNECT_MAILBOX",
      entityId: "mb-1",
      userId: "u1",
    });
  });

  it("maps exchange failures without leaking", async () => {
    const p = provider();
    p.exchangeCode.mockRejectedValue(new Error("invalid_grant"));
    mockedGetProvider.mockReturnValue(p);
    const { state, nonce } = signOAuthState({
      userId: "u1",
      organizationId: "o1",
      provider: "OUTLOOK",
    });
    expect(
      await completeConnect({
        provider: "OUTLOOK",
        code: "c",
        state,
        providerError: null,
        cookieNonce: nonce,
        session,
        redirectUri: "r",
      })
    ).toEqual({ ok: false, error: "exchange_failed" });
  });
});
