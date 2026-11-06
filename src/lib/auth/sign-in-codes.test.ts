import { describe, expect, it } from "vitest";
import { resolvePostSignInPath, safeCallbackUrl } from "./sign-in-codes";
import {
  normalizeUsername,
  optionalUsernameSchema,
  usernameSchema,
} from "./username";

describe("safeCallbackUrl", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeCallbackUrl("/subscriptions?x=1")).toBe("/subscriptions?x=1");
  });
  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackUrl("https://evil.test")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.test")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.test")).toBe("/dashboard");
    expect(safeCallbackUrl(undefined, "/x")).toBe("/x");
  });
});

describe("resolvePostSignInPath", () => {
  it("sends platform super admins to the console", () => {
    expect(resolvePostSignInPath({ role: "SUPER_ADMIN" })).toBe("/super-admin");
    expect(
      resolvePostSignInPath(
        { role: "SUPER_ADMIN" },
        { callbackUrl: "/dashboard" }
      )
    ).toBe("/super-admin");
  });
  it("never sends tenant users into the console", () => {
    expect(
      resolvePostSignInPath(
        { role: "ADMIN" },
        { callbackUrl: "/super-admin/tenant" }
      )
    ).toBe("/dashboard");
  });
  it("routes a pending password change first", () => {
    expect(
      resolvePostSignInPath(
        { role: "MEMBER", mustChangePassword: true },
        { callbackUrl: "/approvals" }
      )
    ).toBe("/change-password?callbackUrl=%2Fapprovals");
  });
});

describe("username rules", () => {
  it("normalises to lower case", () => {
    expect(normalizeUsername("  Jane.Doe ")).toBe("jane.doe");
    expect(usernameSchema.parse("Jane_Doe-1")).toBe("jane_doe-1");
  });
  it("rejects bad formats", () => {
    for (const bad of [
      "ab",
      "a@b",
      ".jane",
      "jane.",
      "ja..ne",
      "x".repeat(33),
      "jané",
    ]) {
      expect(usernameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
  it("treats empty as cleared", () => {
    expect(optionalUsernameSchema.parse("")).toBeNull();
    expect(optionalUsernameSchema.parse(undefined)).toBeNull();
    expect(optionalUsernameSchema.parse("Jane")).toBe("jane");
  });
});
