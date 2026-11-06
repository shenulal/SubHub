// src/actions/super-admin/tenant-admins.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async () => "hashed"),
  verifyPassword: vi.fn(async () => false),
}));
vi.mock("@/lib/auth/password-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/password-policy")>()),
  getPasswordPolicy: vi.fn(),
}));
vi.mock("@/lib/services/notification/email", () => ({
  sendInvitationEmail: vi.fn(),
}));
vi.mock("@/lib/services/notification/email.utils", () => ({
  getBaseUrl: () => "https://subhub.test",
}));
vi.mock("@/lib/settings/service", () => ({ getSetting: vi.fn(async () => 7) }));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    invitation: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getPasswordPolicy } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import {
  SUPER_ADMIN,
  TENANT_ADMIN,
  TEST_POLICY,
  signInAs,
} from "@/test/platform-session-mock";
import { addTenantAdmin, resetTenantAdminPassword } from "./tenant-admins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function mockTx() {
  const tx = {
    user: { create: vi.fn().mockResolvedValue({ id: "u-2" }), update: vi.fn() },
    invitation: {
      upsert: vi.fn().mockResolvedValue({ id: "inv-2", token: "tok-2" }),
    },
    platformAuditLog: { create: vi.fn() },
  };
  db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) =>
    fn(tx)
  );
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  signInAs(SUPER_ADMIN);
  vi.mocked(getPasswordPolicy).mockResolvedValue(TEST_POLICY);
  db.organization.findFirst.mockResolvedValue({ id: "org-1", name: "Acme" });
  db.user.findUnique.mockResolvedValue(null);
  db.invitation.findFirst.mockResolvedValue(null);
  vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true } as never);
});

describe("addTenantAdmin", () => {
  it("denies a tenant ADMIN (even of the same tenant)", async () => {
    signInAs(TENANT_ADMIN);
    const result = await addTenantAdmin({
      organizationId: "org-1",
      name: "B",
      email: "b@acme.com",
      method: "invite",
    });
    expect(result.success).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("invites another admin and audits with the tenant id", async () => {
    const tx = mockTx();
    const result = await addTenantAdmin({
      organizationId: "org-1",
      name: "B",
      email: "b@acme.com",
      method: "invite",
    });
    expect(result).toMatchObject({
      success: true,
      data: { method: "invite", emailSent: true },
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "INVITE_TENANT_ADMIN",
        metadata: { organizationId: "org-1" },
      }),
    });
  });

  it("creates a password admin with a typed temporary password", async () => {
    const tx = mockTx();
    const result = await addTenantAdmin({
      organizationId: "org-1",
      name: "B",
      email: "b@acme.com",
      method: "password",
      password: "Strong-Pass-42",
    });
    expect(result.data?.temporaryPassword).toBeUndefined();
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      mustChangePassword: true,
      role: "ADMIN",
    });
  });

  it("refuses to take over an existing account with a password", async () => {
    db.user.findUnique.mockResolvedValue({
      organizationId: null,
      role: "MEMBER",
    });
    const result = await addTenantAdmin({
      organizationId: "org-1",
      name: "B",
      email: "b@acme.com",
      method: "password",
    });
    expect(result.error).toMatch(/Send an invitation/);
  });

  it("refuses a duplicate pending invitation", async () => {
    db.invitation.findFirst.mockResolvedValue({ id: "inv-old" });
    const result = await addTenantAdmin({
      organizationId: "org-1",
      name: "B",
      email: "b@acme.com",
      method: "invite",
    });
    expect(result.error).toMatch(/already pending/);
  });
});

describe("resetTenantAdminPassword", () => {
  it("only resets administrators of that tenant", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const result = await resetTenantAdminPassword({
      organizationId: "org-1",
      userId: "member-1",
    });
    expect(result.success).toBe(false);
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({
      organizationId: "org-1",
      role: "ADMIN",
    });
  });

  it("generates a temporary password, forces a change and audits", async () => {
    db.user.findFirst.mockResolvedValue({
      id: "ta-1",
      email: TENANT_ADMIN.email,
      passwordHash: "old",
      passwordHistory: [],
    });
    const tx = mockTx();
    const result = await resetTenantAdminPassword({
      organizationId: "org-1",
      userId: "ta-1",
    });
    expect(result.data?.temporaryPassword).toMatch(/^.{14,}$/);
    expect(tx.user.update.mock.calls[0][0].data).toMatchObject({
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    expect(JSON.stringify(tx.platformAuditLog.create.mock.calls)).not.toContain(
      result.data!.temporaryPassword!
    );
  });
});
