import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    invitation: { findFirst: vi.fn() },
    otpToken: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/notification/email-auth", () => ({
  sendOtpEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/logging", () => ({
  withLogging: (_name: string, fn: unknown) => fn,
}));

vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

vi.mock("@/lib/deployment/tenancy", () => ({
  getSingleTenantOrganization: vi.fn().mockResolvedValue({ id: "org-1" }),
}));

const settings: Record<string, unknown> = {};
vi.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: vi.fn(async (_org: string | null, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, settings[k]]))
  ),
}));

const devOtp = { override: null as string | null, logInstead: false };
vi.mock("./otp-dev", () => ({
  getDevOtpOverride: () => devOtp.override,
  shouldLogOtpInsteadOfEmail: () => devOtp.logInstead,
}));

import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/services/notification/email-auth";
import { sendOtp, verifyOtp } from "./otp";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  user: { findFirst: Fn; create: Fn };
  invitation: { findFirst: Fn };
  otpToken: {
    findFirst: Fn;
    deleteMany: Fn;
    create: Fn;
    update: Fn;
    delete: Fn;
  };
};
const mockedSendOtpEmail = sendOtpEmail as Fn;

const TEST_EMAIL = "test@example.com";
const TEST_CODE = "123456";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(settings, {
    "security.allowEmailCodeSignIn": true,
    "security.otpExpiryMinutes": 10,
    "security.otpMaxAttempts": 5,
    "security.authEmailCooldownSeconds": 60,
  });
  db.user.findFirst.mockResolvedValue({
    id: "user-1",
    email: TEST_EMAIL,
    name: "Test User",
    organizationId: "org-1",
  });
  db.invitation.findFirst.mockResolvedValue(null);
  db.otpToken.findFirst.mockResolvedValue(null);
  db.otpToken.deleteMany.mockResolvedValue({ count: 0 });
  db.otpToken.create.mockResolvedValue({ id: "token-1" });
  mockedSendOtpEmail.mockResolvedValue({ success: true });
  devOtp.override = null;
  devOtp.logInstead = false;
});

describe("sendOtp", () => {
  it("is refused while email-code sign-in is disabled (default)", async () => {
    settings["security.allowEmailCodeSignIn"] = false;
    const result = await sendOtp(TEST_EMAIL);
    expect(result).toEqual({ success: false, error: "EMAIL_CODE_DISABLED" });
    expect(db.otpToken.create).not.toHaveBeenCalled();
  });

  it("uses the fixed development code and skips email when AUTH_DEV_OTP is set", async () => {
    devOtp.override = "246810";
    const result = await sendOtp(TEST_EMAIL);
    expect(result.success).toBe(true);
    expect(db.otpToken.create.mock.calls[0][0].data.code).toBe("246810");
    expect(mockedSendOtpEmail).not.toHaveBeenCalled();
  });

  it("succeeds without email when no provider is configured locally", async () => {
    devOtp.logInstead = true;
    const result = await sendOtp(TEST_EMAIL);
    expect(result.success).toBe(true);
    expect(mockedSendOtpEmail).not.toHaveBeenCalled();
  });

  it("answers an unknown email like a success and sends nothing", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const result = await sendOtp("unknown@example.com");
    expect(result.success).toBe(true);
    expect(db.otpToken.create).not.toHaveBeenCalled();
    expect(mockedSendOtpEmail).not.toHaveBeenCalled();
  });

  it("creates a provisional account for an invited email", async () => {
    db.user.findFirst.mockResolvedValue(null);
    db.invitation.findFirst.mockResolvedValue({ organizationId: "org-2" });
    db.user.create.mockResolvedValue({
      id: "user-2",
      email: "new@example.com",
      name: null,
      organizationId: null,
    });
    const result = await sendOtp("new@example.com");
    expect(result.success).toBe(true);
    expect(db.user.create).toHaveBeenCalled();
    expect(mockedSendOtpEmail).toHaveBeenCalled();
  });

  it("returns COOLDOWN_ACTIVE when a code was sent within the cooldown", async () => {
    db.otpToken.findFirst.mockResolvedValue({ id: "recent" });
    const result = await sendOtp(TEST_EMAIL);
    expect(result).toEqual({ success: false, error: "COOLDOWN_ACTIVE" });
  });

  it("deletes existing tokens, creates a 6-digit code and emails it", async () => {
    const result = await sendOtp(TEST_EMAIL);
    expect(result.success).toBe(true);
    expect(db.otpToken.deleteMany).toHaveBeenCalledWith({
      where: { email: TEST_EMAIL },
    });
    const data = db.otpToken.create.mock.calls[0][0].data;
    expect(data.code).toMatch(/^\d{6}$/);
    expect(data.expires.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    expect(mockedSendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: TEST_EMAIL })
    );
  });

  it("returns EMAIL_SEND_FAILED when the email service fails", async () => {
    mockedSendOtpEmail.mockResolvedValue({ success: false, error: "boom" });
    const result = await sendOtp(TEST_EMAIL);
    expect(result).toEqual({ success: false, error: "EMAIL_SEND_FAILED" });
  });
});

describe("verifyOtp", () => {
  const token = (overrides: Record<string, unknown> = {}) => ({
    id: "token-1",
    email: TEST_EMAIL,
    code: TEST_CODE,
    expires: new Date(Date.now() + 60_000),
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  });

  it("returns NO_ACTIVE_OTP when no token is found", async () => {
    const result = await verifyOtp(TEST_EMAIL, TEST_CODE);
    expect(result).toEqual({ success: false, error: "NO_ACTIVE_OTP" });
    expect(db.otpToken.update).not.toHaveBeenCalled();
    expect(db.otpToken.delete).not.toHaveBeenCalled();
  });

  it("returns MAX_ATTEMPTS_EXCEEDED at the configured attempt limit", async () => {
    db.otpToken.findFirst.mockResolvedValue(token({ attempts: 5 }));
    const result = await verifyOtp(TEST_EMAIL, TEST_CODE);
    expect(result).toEqual({ success: false, error: "MAX_ATTEMPTS_EXCEEDED" });
  });

  it("returns INVALID_OTP and increments attempts for a wrong code", async () => {
    db.otpToken.findFirst.mockResolvedValue(token());
    const result = await verifyOtp(TEST_EMAIL, "000000");
    expect(result).toEqual({ success: false, error: "INVALID_OTP" });
    expect(db.otpToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("succeeds and deletes the token for the right code", async () => {
    db.otpToken.findFirst.mockResolvedValue(token());
    const result = await verifyOtp(TEST_EMAIL, TEST_CODE);
    expect(result).toEqual({ success: true });
    expect(db.otpToken.delete).toHaveBeenCalledWith({
      where: { id: "token-1" },
    });
  });

  it("only considers unexpired tokens", async () => {
    await verifyOtp(TEST_EMAIL, TEST_CODE);
    expect(db.otpToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: TEST_EMAIL, expires: { gt: expect.any(Date) } },
      })
    );
  });
});
