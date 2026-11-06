import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth-settings", () => ({
  getAuthSettings: vi.fn(async (_org: string | null, keys: string[]) =>
    Object.fromEntries(
      keys.map((k) => [
        k,
        {
          "security.passwordMinLength": 12,
          "security.passwordRequireUppercase": true,
          "security.passwordRequireLowercase": true,
          "security.passwordRequireNumber": false,
          "security.passwordRequireSymbol": true,
          "security.passwordHistoryCount": 2,
        }[k],
      ])
    )
  ),
}));
vi.mock("@/lib/deployment/tenancy", () => ({
  getSingleTenantOrganization: vi.fn().mockResolvedValue(null),
}));
vi.mock("./password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyPassword: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
}));

import { getAuthSettings } from "./auth-settings";
import {
  buildPasswordUpdate,
  checkPasswordPolicy,
  describePasswordPolicy,
  getPasswordPolicy,
  getSignupPasswordPolicy,
  isRecentlyUsedPassword,
  validateNewPassword,
  type PasswordPolicy,
} from "./password-policy";

const strict: PasswordPolicy = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  historyCount: 0,
};

beforeEach(() => vi.clearAllMocks());

describe("password policy", () => {
  it("reads the policy from the organisation settings", async () => {
    const policy = await getPasswordPolicy("org-1");
    expect(getAuthSettings).toHaveBeenCalledWith("org-1", expect.any(Array));
    expect(policy).toEqual({
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: false,
      requireSymbol: true,
      historyCount: 2,
    });
  });

  it("uses the platform values before sign-up when there is no organisation", async () => {
    await getSignupPasswordPolicy();
    expect(getAuthSettings).toHaveBeenCalledWith(null, expect.any(Array));
  });

  it("accepts a password meeting every rule", () => {
    expect(checkPasswordPolicy("Abcdefgh1!", strict)).toEqual([]);
  });

  it("lists each unmet rule", () => {
    const issues = checkPasswordPolicy("short", strict);
    expect(issues).toEqual([
      "Password must be at least 10 characters",
      "Password must contain an uppercase letter",
      "Password must contain a number",
      "Password must contain a symbol",
    ]);
  });

  it("skips character classes that are switched off", () => {
    const relaxed = { ...strict, requireNumber: false, requireSymbol: false };
    expect(checkPasswordPolicy("Abcdefghij", relaxed)).toEqual([]);
  });

  it("caps the length at bcrypt's 72 bytes", () => {
    expect(checkPasswordPolicy(`Aa1!${"x".repeat(70)}`, strict)).toContain(
      "Password must be 72 characters or fewer"
    );
  });

  it("describes the policy for hints", () => {
    expect(describePasswordPolicy(strict)).toBe(
      "Use at least 10 characters with an uppercase letter, a lowercase letter, a number, a symbol."
    );
  });

  it("detects reuse of the current or remembered passwords", async () => {
    const account = {
      passwordHash: "hash:new1",
      passwordHistory: ["hash:old1", "hash:old2"],
    };
    expect(await isRecentlyUsedPassword("new1", account, 2)).toBe(true);
    expect(await isRecentlyUsedPassword("old1", account, 2)).toBe(true);
    expect(await isRecentlyUsedPassword("old2", account, 2)).toBe(false);
    expect(await isRecentlyUsedPassword("new1", account, 0)).toBe(false);
  });

  it("rotates the history and clears lockout on a new password", async () => {
    const data = await buildPasswordUpdate(
      "Fresh-Pass1",
      { passwordHash: "hash:a", passwordHistory: ["hash:b", "hash:c"] },
      { historyCount: 2, mustChangePassword: true }
    );
    expect(data).toMatchObject({
      passwordHash: "hash:Fresh-Pass1",
      passwordHistory: ["hash:a", "hash:b"],
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustChangePassword: true,
    });
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
  });

  it("validateNewPassword reports policy and history problems", async () => {
    const policy = { ...strict, historyCount: 1 };
    expect(await validateNewPassword("weak", null, policy)).toContain(
      "at least"
    );
    expect(
      await validateNewPassword(
        "Abcdefgh1!",
        { passwordHash: "hash:Abcdefgh1!", passwordHistory: [] },
        policy
      )
    ).toContain("not used");
    expect(await validateNewPassword("Abcdefgh1!", null, policy)).toBeNull();
  });
});
