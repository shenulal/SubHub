// src/lib/platform/passwords.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/password-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/password-policy")>()),
  getPasswordPolicy: vi.fn(async () => ({
    minLength: 16,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    historyCount: 0,
  })),
}));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

import {
  generateTemporaryPassword,
  resolveTemporaryPassword,
} from "./passwords";

describe("generateTemporaryPassword", () => {
  it("has the requested length and every character class", () => {
    for (let i = 0; i < 20; i++) {
      const p = generateTemporaryPassword(14);
      expect(p).toHaveLength(14);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
    }
  });
});

describe("resolveTemporaryPassword", () => {
  it("generates at least the policy length when nothing is typed", async () => {
    const r = await resolveTemporaryPassword("", null);
    expect(r).toMatchObject({ ok: true, generated: true });
    if (r.ok) expect(r.password.length).toBe(16);
  });

  it("validates a typed password against the policy", async () => {
    expect(await resolveTemporaryPassword("Short-1a", "org-1")).toMatchObject({
      ok: false,
    });
    expect(
      await resolveTemporaryPassword("Long-Enough-Pass-1", "org-1")
    ).toMatchObject({ ok: true, generated: false });
  });
});
