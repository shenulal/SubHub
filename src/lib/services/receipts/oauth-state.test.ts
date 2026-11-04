// src/lib/services/receipts/oauth-state.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  OAUTH_STATE_TTL_MS,
  signOAuthState,
  verifyOAuthState,
} from "./oauth-state";

const base = { userId: "u1", organizationId: "o1", provider: "GMAIL" as const };

describe("oauth state", () => {
  const saved = process.env.NEXTAUTH_SECRET;
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = saved;
  });

  it("round-trips a signed state with the cookie nonce", () => {
    const { state, nonce } = signOAuthState(base);
    const result = verifyOAuthState(state, nonce);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload).toMatchObject({ ...base, nonce });
  });

  it("rejects a tampered payload", () => {
    const { state, nonce } = signOAuthState(base);
    const [encoded, sig] = state.split(".");
    const tampered = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(encoded, "base64url").toString()),
        userId: "attacker",
      })
    ).toString("base64url");
    expect(verifyOAuthState(`${tampered}.${sig}`, nonce)).toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });

  it("rejects a state signed with another secret", () => {
    const { state, nonce } = signOAuthState(base);
    process.env.NEXTAUTH_SECRET = "other";
    expect(verifyOAuthState(state, nonce)).toEqual({
      ok: false,
      reason: "BAD_SIGNATURE",
    });
  });

  it("rejects malformed input", () => {
    expect(verifyOAuthState(null, "n")).toEqual({
      ok: false,
      reason: "MALFORMED",
    });
    expect(verifyOAuthState("no-dot", "n")).toEqual({
      ok: false,
      reason: "MALFORMED",
    });
    const encoded = Buffer.from("not json").toString("base64url");
    const sig = signOAuthState(base).state.split(".")[1];
    expect(verifyOAuthState(`${encoded}.${sig}`, "n").ok).toBe(false);
  });

  it("rejects a payload missing required fields even when signed", () => {
    const { state, nonce } = signOAuthState({ ...base, organizationId: "" });
    expect(verifyOAuthState(state, nonce)).toEqual({
      ok: false,
      reason: "MALFORMED",
    });
  });

  it("expires after the TTL", () => {
    const { state, nonce } = signOAuthState(base);
    expect(
      verifyOAuthState(state, nonce, Date.now() + OAUTH_STATE_TTL_MS + 1)
    ).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("requires the cookie nonce to match", () => {
    const { state } = signOAuthState(base);
    expect(verifyOAuthState(state, "different")).toEqual({
      ok: false,
      reason: "NONCE_MISMATCH",
    });
    expect(verifyOAuthState(state, null)).toEqual({
      ok: false,
      reason: "NONCE_MISMATCH",
    });
  });

  it("fails loudly without a signing secret", () => {
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    expect(() => signOAuthState(base)).toThrow(/NEXTAUTH_SECRET/);
  });
});
