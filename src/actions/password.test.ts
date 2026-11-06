import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { delete: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "u1", organizationId: "org-1" },
  }),
}));
vi.mock("@/lib/auth/auth-audit", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/auth-audit")>()),
  recordAuthEvent: vi.fn(),
}));
vi.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: vi.fn(async () => ({
    "security.passwordResetExpiryMinutes": 30,
    "security.authEmailCooldownSeconds": 60,
  })),
}));
vi.mock("@/lib/auth/authorize", () => ({ findAccountByIdentifier: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(async (p: string, h: string) => h === `hash:${p}`),
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
}));
vi.mock("@/lib/auth/password-policy", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/password-policy")>()),
  getPasswordPolicy: vi.fn().mockResolvedValue({
    minLength: 10,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSymbol: true,
    historyCount: 0,
  }),
}));
vi.mock("@/lib/auth/password-reset", () => ({
  createResetToken: vi
    .fn()
    .mockResolvedValue({ token: "raw-token", expires: new Date() }),
  findResetToken: vi.fn(),
  hasRecentResetToken: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/services/notification/email-auth", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
  passwordResetUrl: (t: string) => `http://localhost/reset-password/${t}`,
}));
const dev = { log: false };
vi.mock("@/actions/otp-dev", () => ({
  getDevOtpOverride: () => null,
  shouldLogOtpInsteadOfEmail: () => dev.log,
}));

import { recordAuthEvent } from "@/lib/auth/auth-audit";
import { findAccountByIdentifier } from "@/lib/auth/authorize";
import {
  createResetToken,
  findResetToken,
  hasRecentResetToken,
} from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendPasswordResetEmail } from "@/lib/services/notification/email-auth";
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "./password";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  user: { findUnique: Fn; update: Fn };
  passwordResetToken: { delete: Fn; deleteMany: Fn };
};

const account = {
  id: "u1",
  email: "jane@acme.test",
  name: "Jane",
  organizationId: "org-1",
  status: "ACTIVE",
  passwordHash: "hash:Current-Pass1",
  passwordHistory: [],
  mustChangePassword: false,
};

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  dev.log = false;
});

describe("requestPasswordReset", () => {
  it("answers the same for an unknown account and sends nothing", async () => {
    vi.mocked(findAccountByIdentifier).mockResolvedValue(null);
    const result = await requestPasswordReset(form({ email: "nobody" }));
    expect(result.success).toBe(true);
    expect(createResetToken).not.toHaveBeenCalled();
  });

  it("emails a link with the configured validity", async () => {
    vi.mocked(findAccountByIdentifier).mockResolvedValue(account as never);
    const result = await requestPasswordReset({ email: "jane" });
    expect(result.success).toBe(true);
    expect(createResetToken).toHaveBeenCalledWith("jane@acme.test", 30);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@acme.test",
        token: "raw-token",
        expiryMinutes: 30,
      })
    );
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_PASSWORD_RESET_REQUESTED" })
    );
  });

  it("logs the link locally instead of emailing when no provider is configured", async () => {
    dev.log = true;
    vi.mocked(findAccountByIdentifier).mockResolvedValue(account as never);
    await requestPasswordReset({ email: "jane@acme.test" });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        resetUrl: "http://localhost/reset-password/raw-token",
      }),
      expect.any(String)
    );
  });

  it("does not issue another link inside the cooldown", async () => {
    vi.mocked(findAccountByIdentifier).mockResolvedValue(account as never);
    vi.mocked(hasRecentResetToken).mockResolvedValueOnce(true);
    const result = await requestPasswordReset({ email: "jane" });
    expect(result.success).toBe(true);
    expect(createResetToken).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  it("rejects an invalid token", async () => {
    vi.mocked(findResetToken).mockResolvedValue({ status: "invalid" });
    const result = await resetPassword({ token: "x", password: "New-Pass12!" });
    expect(result).toMatchObject({
      success: false,
      message: "Invalid reset link",
    });
  });

  it("rejects and removes an expired token", async () => {
    vi.mocked(findResetToken).mockResolvedValue({
      status: "expired",
      id: "t1",
      email: "jane@acme.test",
    });
    const result = await resetPassword({ token: "x", password: "New-Pass12!" });
    expect(result.success).toBe(false);
    expect(db.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { id: "t1" },
    });
  });

  it("enforces the policy", async () => {
    vi.mocked(findResetToken).mockResolvedValue({
      status: "valid",
      id: "t1",
      email: "jane@acme.test",
    });
    db.user.findUnique.mockResolvedValue(account);
    const result = await resetPassword({ token: "x", password: "weakpass" });
    expect(result.success).toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("sets the new password, consumes the token and audits", async () => {
    vi.mocked(findResetToken).mockResolvedValue({
      status: "valid",
      id: "t1",
      email: "jane@acme.test",
    });
    db.user.findUnique.mockResolvedValue(account);
    const result = await resetPassword({ token: "x", password: "New-Pass12!" });
    expect(result.success).toBe(true);
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      passwordHash: "hash:New-Pass12!",
      mustChangePassword: false,
      lockedUntil: null,
    });
    expect(db.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { email: "jane@acme.test" },
    });
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_PASSWORD_RESET" })
    );
  });
});

describe("changePassword", () => {
  it("requires the current password", async () => {
    db.user.findUnique.mockResolvedValue(account);
    const result = await changePassword(
      { success: false },
      form({
        currentPassword: "wrong",
        newPassword: "New-Pass12!",
        confirmPassword: "New-Pass12!",
      })
    );
    expect(result).toMatchObject({
      success: false,
      message: "Your current password is incorrect",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    const result = await changePassword(
      { success: false },
      form({
        currentPassword: "Current-Pass1",
        newPassword: "New-Pass12!",
        confirmPassword: "Other-Pass12!",
      })
    );
    expect(result.success).toBe(false);
  });

  it("changes the password and clears a forced change", async () => {
    db.user.findUnique.mockResolvedValue({
      ...account,
      mustChangePassword: true,
    });
    const result = await changePassword(
      { success: false },
      form({
        currentPassword: "Current-Pass1",
        newPassword: "New-Pass12!",
        confirmPassword: "New-Pass12!",
      })
    );
    expect(result.success).toBe(true);
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      passwordHash: "hash:New-Pass12!",
      mustChangePassword: false,
    });
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AUTH_PASSWORD_CHANGED",
        metadata: { forced: true },
      })
    );
  });
});
