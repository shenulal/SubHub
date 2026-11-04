// src/lib/services/receipts/tokens.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  decryptTokens,
  encryptTokens,
  isExpiringSoon,
  TOKEN_REFRESH_SKEW_MS,
} from "./tokens";

vi.mock("@/lib/crypto", () => ({
  encrypt: (v: string) => `enc(${v})`,
  decrypt: (v: string) => v.replace(/^enc\((.*)\)$/, "$1"),
}));

describe("tokens", () => {
  it("encrypts both tokens and round-trips", () => {
    const stored = encryptTokens({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000,
    });
    expect(stored).toEqual({
      accessToken: "enc(a)",
      refreshToken: "enc(r)",
      expiresAt: new Date(1000),
    });
    expect(decryptTokens(stored)).toEqual({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: 1000,
    });
  });

  it("handles missing refresh token and expiry", () => {
    const stored = encryptTokens({ accessToken: "a" });
    expect(stored.refreshToken).toBeNull();
    expect(stored.expiresAt).toBeNull();
    expect(decryptTokens(stored)).toEqual({
      accessToken: "a",
      refreshToken: null,
      expiresAt: null,
    });
  });

  it("detects imminent expiry", () => {
    const now = 1_000_000;
    expect(
      isExpiringSoon(
        { accessToken: "a", expiresAt: now + TOKEN_REFRESH_SKEW_MS - 1 },
        now
      )
    ).toBe(true);
    expect(
      isExpiringSoon(
        { accessToken: "a", expiresAt: now + TOKEN_REFRESH_SKEW_MS + 1 },
        now
      )
    ).toBe(false);
    expect(isExpiringSoon({ accessToken: "a", expiresAt: null }, now)).toBe(
      false
    );
  });
});
