import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("./password", () => ({
  hashPassword: vi.fn(async () => "dummy-hash"),
  verifyPassword: vi.fn(),
}));
vi.mock("./auth-audit", async (orig) => ({
  ...(await orig<typeof import("./auth-audit")>()),
  recordAuthEvent: vi.fn(),
}));
const settings = {
  "security.maxFailedSignInAttempts": 3,
  "security.lockoutMinutes": 15,
  "security.requireLoginOtp": false,
  "security.enforceSso": false,
  "security.allowEmailCodeSignIn": false,
} as Record<string, unknown>;
vi.mock("./auth-settings", () => ({
  getAuthSettings: vi.fn(async (_org: string | null, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, settings[k]]))
  ),
}));
vi.mock("./login-otp", () => ({
  issueLoginCode: vi.fn(async () => "sent"),
  verifyLoginCode: vi.fn(async () => "ok"),
  isOtpFormat: (c: unknown) => typeof c === "string" && /^\d{6}$/.test(c),
}));

import { prisma } from "@/lib/db";
import { recordAuthEvent } from "./auth-audit";
import { authorizeEmailCode, authorizePassword } from "./authorize";
import { issueLoginCode, verifyLoginCode } from "./login-otp";
import { verifyPassword } from "./password";
import { SIGN_IN_CODES } from "./sign-in-codes";

const db = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "jane@acme.test",
    name: "Jane",
    image: null,
    role: "MEMBER",
    status: "ACTIVE",
    organizationId: "org-1",
    passwordHash: "hash",
    failedLoginAttempts: 0,
    lockedUntil: null,
    loginOtpEnabled: false,
    ...overrides,
  };
}

const opts = { ssoAvailable: false };

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  settings["security.requireLoginOtp"] = false;
  settings["security.enforceSso"] = false;
  settings["security.allowEmailCodeSignIn"] = false;
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(verifyLoginCode).mockResolvedValue("ok");
  vi.mocked(issueLoginCode).mockResolvedValue("sent");
});

describe("authorizePassword", () => {
  it("signs in with email + correct password and audits success", async () => {
    db.user.findFirst.mockResolvedValue(account());
    const user = await authorizePassword(
      { identifier: "Jane@Acme.test", password: "pw" },
      opts
    );
    expect(user).toEqual({
      id: "u1",
      email: "jane@acme.test",
      name: "Jane",
      image: null,
    });
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: "Jane@Acme.test", mode: "insensitive" } },
      })
    );
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_SIGN_IN_SUCCEEDED" })
    );
  });

  it("looks a user name up lower-cased", async () => {
    db.user.findUnique.mockResolvedValue(account());
    await authorizePassword({ identifier: " Jane.Doe ", password: "pw" }, opts);
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "jane.doe" } })
    );
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("returns the generic error for an unknown account", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const code = await codeOf(
      authorizePassword({ identifier: "x@y.test", password: "pw" }, opts)
    );
    expect(code).toBe(SIGN_IN_CODES.invalid);
    expect(verifyPassword).toHaveBeenCalled(); // timing equaliser
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("returns the generic error for an account without a password", async () => {
    db.user.findFirst.mockResolvedValue(account({ passwordHash: null }));
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw" },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.invalid);
  });

  it("counts a wrong password and returns the generic error", async () => {
    db.user.findFirst.mockResolvedValue(account({ failedLoginAttempts: 1 }));
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const code = await codeOf(
      authorizePassword({ identifier: "jane@acme.test", password: "bad" }, opts)
    );
    expect(code).toBe(SIGN_IN_CODES.invalid);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { failedLoginAttempts: 2, lockedUntil: null },
    });
  });

  it("locks the account when the attempt limit is reached", async () => {
    db.user.findFirst.mockResolvedValue(account({ failedLoginAttempts: 2 }));
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const code = await codeOf(
      authorizePassword({ identifier: "jane@acme.test", password: "bad" }, opts)
    );
    expect(code).toBe(SIGN_IN_CODES.locked);
    const data = db.user.update.mock.calls[0][0].data;
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil.getTime()).toBeGreaterThan(
      Date.now() + 14 * 60_000
    );
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "AUTH_ACCOUNT_LOCKED" })
    );
  });

  it("refuses a locked account even with the right password", async () => {
    db.user.findFirst.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() + 60_000) })
    );
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw" },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.locked);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("clears the counters after a successful sign-in", async () => {
    db.user.findFirst.mockResolvedValue(account({ failedLoginAttempts: 2 }));
    await authorizePassword(
      { identifier: "jane@acme.test", password: "pw" },
      opts
    );
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it("emails a code and asks for it when the organisation requires OTP", async () => {
    settings["security.requireLoginOtp"] = true;
    db.user.findFirst.mockResolvedValue(account());
    const code = await codeOf(
      authorizePassword({ identifier: "jane@acme.test", password: "pw" }, opts)
    );
    expect(code).toBe(SIGN_IN_CODES.otpRequired);
    expect(issueLoginCode).toHaveBeenCalledWith({
      email: "jane@acme.test",
      organizationId: "org-1",
      userName: "Jane",
    });
  });

  it("asks for a code when the user opted in, ignoring client flags", async () => {
    db.user.findFirst.mockResolvedValue(account({ loginOtpEnabled: true }));
    const code = await codeOf(
      authorizePassword(
        { identifier: "jane@acme.test", password: "pw", otpVerified: "true" },
        opts
      )
    );
    expect(code).toBe(SIGN_IN_CODES.otpRequired);
  });

  it("completes sign-in with a valid code", async () => {
    settings["security.requireLoginOtp"] = true;
    db.user.findFirst.mockResolvedValue(account());
    const user = await authorizePassword(
      { identifier: "jane@acme.test", password: "pw", otp: "123456" },
      opts
    );
    expect(user.id).toBe("u1");
    expect(verifyLoginCode).toHaveBeenCalledWith({
      email: "jane@acme.test",
      code: "123456",
      organizationId: "org-1",
    });
    expect(issueLoginCode).not.toHaveBeenCalled();
  });

  it("rejects a wrong code", async () => {
    settings["security.requireLoginOtp"] = true;
    db.user.findFirst.mockResolvedValue(account());
    vi.mocked(verifyLoginCode).mockResolvedValue("invalid");
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw", otp: "000000" },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.otpInvalid);
  });

  it("never checks the code before the password is right", async () => {
    settings["security.requireLoginOtp"] = true;
    db.user.findFirst.mockResolvedValue(account());
    vi.mocked(verifyPassword).mockResolvedValue(false);
    await codeOf(
      authorizePassword(
        { identifier: "jane@acme.test", password: "bad", otp: "123456" },
        opts
      )
    );
    expect(verifyLoginCode).not.toHaveBeenCalled();
    expect(issueLoginCode).not.toHaveBeenCalled();
  });

  it("reports a delivery failure for the code", async () => {
    settings["security.requireLoginOtp"] = true;
    db.user.findFirst.mockResolvedValue(account());
    vi.mocked(issueLoginCode).mockResolvedValue("failed");
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw" },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.otpDeliveryFailed);
  });

  it("signs in a user with a forced password change (handled after sign-in)", async () => {
    db.user.findFirst.mockResolvedValue(account({ mustChangePassword: true }));
    const user = await authorizePassword(
      { identifier: "jane@acme.test", password: "temp" },
      opts
    );
    expect(user.id).toBe("u1");
  });

  it("refuses terminated members with the generic error", async () => {
    db.user.findFirst.mockResolvedValue(account({ status: "TERMINATED" }));
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw" },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.invalid);
  });

  it("lets a platform super admin (no organisation) sign in", async () => {
    db.user.findFirst.mockResolvedValue(
      account({ role: "SUPER_ADMIN", organizationId: null })
    );
    const user = await authorizePassword(
      {
        identifier: "root@platform.test",
        password: "pw",
        audience: "platform",
      },
      opts
    );
    expect(user.id).toBe("u1");
  });

  it("refuses a disabled (INACTIVE) platform super admin", async () => {
    db.user.findFirst.mockResolvedValue(
      account({ role: "SUPER_ADMIN", organizationId: null, status: "INACTIVE" })
    );
    expect(
      await codeOf(
        authorizePassword(
          {
            identifier: "root@platform.test",
            password: "pw",
            audience: "platform",
          },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.invalid);
  });

  it("still lets an INACTIVE tenant member sign in (directory/usage state)", async () => {
    db.user.findFirst.mockResolvedValue(account({ status: "INACTIVE" }));
    const user = await authorizePassword(
      { identifier: "jane@acme.test", password: "pw" },
      opts
    );
    expect(user.id).toBe("u1");
  });

  it("refuses tenant users on the platform sign-in", async () => {
    db.user.findFirst.mockResolvedValue(account({ role: "ADMIN" }));
    expect(
      await codeOf(
        authorizePassword(
          {
            identifier: "jane@acme.test",
            password: "pw",
            audience: "platform",
          },
          opts
        )
      )
    ).toBe(SIGN_IN_CODES.invalid);
  });

  it("enforces SSO only when an SSO provider is configured", async () => {
    settings["security.enforceSso"] = true;
    db.user.findFirst.mockResolvedValue(account());
    await expect(
      authorizePassword({ identifier: "jane@acme.test", password: "pw" }, opts)
    ).resolves.toBeTruthy();
    expect(
      await codeOf(
        authorizePassword(
          { identifier: "jane@acme.test", password: "pw" },
          { ssoAvailable: true }
        )
      )
    ).toBe(SIGN_IN_CODES.ssoRequired);
  });

  it("rejects malformed credentials", async () => {
    expect(await codeOf(authorizePassword({ identifier: "" }, opts))).toBe(
      SIGN_IN_CODES.invalid
    );
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("authorizeEmailCode", () => {
  it("is refused while the setting is off", async () => {
    db.user.findFirst.mockResolvedValue(account());
    expect(
      await authorizeEmailCode({ email: "jane@acme.test", otp: "123456" })
    ).toBeNull();
    expect(verifyLoginCode).not.toHaveBeenCalled();
  });

  it("signs in with a valid code when enabled", async () => {
    settings["security.allowEmailCodeSignIn"] = true;
    db.user.findFirst.mockResolvedValue(account());
    const user = await authorizeEmailCode({
      email: "jane@acme.test",
      otp: "123456",
    });
    expect(user?.id).toBe("u1");
  });

  it("rejects a wrong code when enabled", async () => {
    settings["security.allowEmailCodeSignIn"] = true;
    db.user.findFirst.mockResolvedValue(account());
    vi.mocked(verifyLoginCode).mockResolvedValue("invalid");
    expect(
      await authorizeEmailCode({ email: "jane@acme.test", otp: "000000" })
    ).toBeNull();
  });
});
