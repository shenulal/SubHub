import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi
    .fn()
    .mockResolvedValue({ user: { id: "u1", organizationId: "org-1" } }),
}));
vi.mock("@/lib/auth/auth-audit", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/auth-audit")>()),
  recordAuthEvent: vi.fn(),
}));
vi.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: vi.fn(async () => ({ "security.requireLoginOtp": true })),
}));
vi.mock("@/lib/auth/username-service", () => ({ assignUsername: vi.fn() }));

import { recordAuthEvent } from "@/lib/auth/auth-audit";
import { assignUsername } from "@/lib/auth/username-service";
import { prisma } from "@/lib/db";
import {
  getAccountSecurity,
  setOwnTwoStepVerification,
  updateOwnUsername,
} from "./account-security";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { user: { findUnique: Fn; update: Fn } };

beforeEach(() => vi.clearAllMocks());

describe("account security", () => {
  it("returns the signed-in user's sign-in settings", async () => {
    db.user.findUnique.mockResolvedValue({
      username: "jane",
      email: "jane@acme.test",
      passwordHash: "h",
      passwordChangedAt: null,
      loginOtpEnabled: false,
      organizationId: "org-1",
    });
    expect(await getAccountSecurity()).toEqual({
      username: "jane",
      email: "jane@acme.test",
      hasPassword: true,
      passwordChangedAt: null,
      loginOtpEnabled: false,
      loginOtpRequired: true,
    });
    expect(db.user.findUnique.mock.calls[0][0].where).toEqual({ id: "u1" });
  });

  it("saves the user's own user name and audits", async () => {
    vi.mocked(assignUsername).mockResolvedValue({
      ok: true,
      username: "jane",
      changed: true,
    });
    const fd = new FormData();
    fd.set("username", "Jane");
    const result = await updateOwnUsername({ success: false }, fd);
    expect(result.success).toBe(true);
    expect(assignUsername).toHaveBeenCalledWith("u1", "Jane");
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_USERNAME_CHANGED" })
    );
  });

  it("returns a field error when the user name is taken", async () => {
    vi.mocked(assignUsername).mockResolvedValue({
      ok: false,
      message: "That user name is already taken",
    });
    const fd = new FormData();
    fd.set("username", "taken");
    const result = await updateOwnUsername({ success: false }, fd);
    expect(result).toMatchObject({
      success: false,
      errors: { username: ["That user name is already taken"] },
    });
  });

  it("toggles the per-user two-step verification", async () => {
    const result = await setOwnTwoStepVerification(true);
    expect(result.success).toBe(true);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { loginOtpEnabled: true },
    });
  });
});
