import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { user: { findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/rbac/service", async () => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    requirePermission: vi.fn(),
  };
});
vi.mock("@/lib/auth/auth-audit", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/auth-audit")>()),
  recordAuthEvent: vi.fn(),
}));
vi.mock("@/lib/auth/username-service", () => ({
  assignUsername: vi
    .fn()
    .mockResolvedValue({ ok: true, username: "jane", changed: true }),
}));
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: vi.fn(async () => false),
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

import { recordAuthEvent } from "@/lib/auth/auth-audit";
import { prisma } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/lib/rbac/service";
import {
  getMemberCredentials,
  setMemberCredentials,
} from "./member-credentials";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as { user: { findFirst: Fn; update: Fn } };

const member = {
  id: "m1",
  role: "MEMBER",
  email: "m@acme.test",
  organizationId: "org-1",
  username: null,
  passwordHash: null,
  passwordHistory: [],
  mustChangePassword: false,
  passwordChangedAt: null,
  lockedUntil: new Date(Date.now() + 60_000),
  failedLoginAttempts: 0,
};

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    userId: "admin-1",
    organizationId: "org-1",
    role: "ADMIN",
    permissions: new Set(["members:manage_credentials"]),
  } as never);
  db.user.findFirst.mockResolvedValue(member);
});

describe("member credentials", () => {
  it("denies callers without members:manage_credentials", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new (ForbiddenError as unknown as new (m: string) => Error)("Forbidden")
    );
    const result = await setMemberCredentials(
      "m1",
      { success: false },
      form({ password: "Temp-Pass12!" })
    );
    expect(result.success).toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(requirePermission).toHaveBeenCalledWith(
      "members:manage_credentials"
    );
    expect((await getMemberCredentials("m1")).success).toBe(false);
  });

  it("only finds members of the caller's organisation (never super admins)", async () => {
    await getMemberCredentials("m1");
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "m1",
          organizationId: "org-1",
          role: { not: "SUPER_ADMIN" },
        },
      })
    );
  });

  it("reports lock status", async () => {
    const result = await getMemberCredentials("m1");
    expect(result.data?.lockedUntil).toBeTruthy();
    expect(result.data?.hasPassword).toBe(false);
  });

  it("refuses to change your own credentials here", async () => {
    db.user.findFirst.mockResolvedValue({ ...member, id: "admin-1" });
    const result = await setMemberCredentials(
      "admin-1",
      { success: false },
      form({})
    );
    expect(result.success).toBe(false);
  });

  it("sets a temporary password that must be changed at next sign-in", async () => {
    const result = await setMemberCredentials(
      "m1",
      { success: false },
      form({
        username: "jane",
        password: "Temp-Pass12!",
        mustChangePassword: "true",
      })
    );
    expect(result.success).toBe(true);
    expect(db.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: "m1" },
      data: {
        passwordHash: "hash:Temp-Pass12!",
        mustChangePassword: true,
        lockedUntil: null,
      },
    });
    expect(recordAuthEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "AUTH_PASSWORD_SET_BY_ADMIN",
        actorUserId: "admin-1",
      })
    );
  });

  it("rejects a temporary password that breaks the policy", async () => {
    const result = await setMemberCredentials(
      "m1",
      { success: false },
      form({ password: "short" })
    );
    expect(result.success).toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("unlocks without changing the password", async () => {
    const result = await setMemberCredentials(
      "m1",
      { success: false },
      form({ unlock: "true" })
    );
    expect(result.success).toBe(true);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });
});
