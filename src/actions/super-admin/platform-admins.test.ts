// src/actions/super-admin/platform-admins.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (p: string) => `hash(${p.length})`),
  verifyPassword: vi.fn(async () => false),
}));
vi.mock("@/lib/auth/password-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/password-policy")>()),
  getPasswordPolicy: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getPasswordPolicy } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import { LAST_SUPER_ADMIN_MESSAGE } from "@/lib/platform/super-admins";
import {
  signInAs,
  SUPER_ADMIN,
  TENANT_ADMIN,
  TEST_POLICY,
} from "@/test/platform-session-mock";
import {
  createPlatformAdmin,
  listPlatformAdmins,
  resetPlatformAdminPassword,
  setPlatformAdminActive,
} from "./platform-admins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function mockTx(otherActive = 1) {
  const tx = {
    $executeRaw: vi.fn(),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "sa-2" }),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(otherActive),
    },
    platformAuditLog: { create: vi.fn() },
  };
  db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) =>
    fn(tx)
  );
  return tx;
}

const OTHER = {
  id: "sa-2",
  email: "second@platform.test",
  status: "ACTIVE",
  passwordHash: "old",
  passwordHistory: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPasswordPolicy).mockResolvedValue(TEST_POLICY);
  signInAs(SUPER_ADMIN);
});

describe("access", () => {
  it("denies a tenant ADMIN and touches nothing", async () => {
    signInAs(TENANT_ADMIN);
    const result = await listPlatformAdmins();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/platform super administrators/);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });

  it("denies a signed-out visitor", async () => {
    signInAs(null);
    expect(
      (await createPlatformAdmin({ name: "X", email: "x@y.test" })).success
    ).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("listPlatformAdmins", () => {
  it("lists org-less super admins and flags the current user", async () => {
    db.user.findMany.mockResolvedValue([
      { id: "sa-1", email: SUPER_ADMIN.email },
      { id: "sa-2", email: OTHER.email },
    ]);
    const result = await listPlatformAdmins();
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({
      role: "SUPER_ADMIN",
      organizationId: null,
    });
    expect(result.data?.map((r) => r.isCurrentUser)).toEqual([true, false]);
  });
});

describe("createPlatformAdmin", () => {
  it("creates a super admin with a generated temporary password and audits it", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const tx = mockTx();
    const result = await createPlatformAdmin({
      name: "Second",
      email: "Second@Platform.test",
    });
    expect(result.success).toBe(true);
    expect(result.data?.temporaryPassword).toMatch(/^.{14,}$/);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: "second@platform.test",
      role: "SUPER_ADMIN",
      organizationId: null,
      mustChangePassword: true,
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CREATE_SUPER_ADMIN",
        actorId: "sa-1",
      }),
    });
  });

  it("refuses a weak typed password", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const result = await createPlatformAdmin({
      name: "S",
      email: "s@p.test",
      password: "short",
    });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/at least 10/),
    });
  });

  it("refuses an email that already has an account", async () => {
    db.user.findUnique.mockResolvedValue({ id: "ta-1" });
    expect(
      (await createPlatformAdmin({ name: "S", email: TENANT_ADMIN.email }))
        .success
    ).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("setPlatformAdminActive", () => {
  it("keeps at least one active super admin", async () => {
    db.user.findFirst.mockResolvedValue(OTHER);
    const tx = mockTx(0);
    const result = await setPlatformAdminActive({
      userId: "sa-2",
      active: false,
    });
    expect(result).toEqual({ success: false, error: LAST_SUPER_ADMIN_MESSAGE });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("disables another admin when one stays active", async () => {
    db.user.findFirst.mockResolvedValue(OTHER);
    const tx = mockTx(1);
    expect(
      (await setPlatformAdminActive({ userId: "sa-2", active: false })).success
    ).toBe(true);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "sa-2" },
      data: { status: "INACTIVE" },
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DISABLE_SUPER_ADMIN" }),
    });
  });

  it("refuses to disable the signed-in admin", async () => {
    db.user.findFirst.mockResolvedValue({ ...OTHER, id: "sa-1" });
    expect(
      (await setPlatformAdminActive({ userId: "sa-1", active: false })).success
    ).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("resetPlatformAdminPassword", () => {
  it("sets a temporary password that must be changed", async () => {
    db.user.findFirst.mockResolvedValue(OTHER);
    const tx = mockTx();
    const result = await resetPlatformAdminPassword({
      userId: "sa-2",
      password: "Valid-Pass-123",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({
      mustChangePassword: true,
      passwordHistory: ["old"],
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "RESET_SUPER_ADMIN_PASSWORD" }),
    });
  });

  it("ignores ids that are not platform admins", async () => {
    db.user.findFirst.mockResolvedValue(null);
    expect((await resetPlatformAdminPassword({ userId: "ta-1" })).success).toBe(
      false
    );
  });
});
