// src/actions/super-admin/tenant-lifecycle.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("@/lib/masters/organization-defaults", () => ({
  ensureOrganizationDefaults: vi.fn(),
}));
vi.mock("@/lib/services/notification/email", () => ({
  sendInvitationEmail: vi.fn(),
}));
vi.mock("@/lib/services/notification/email.utils", () => ({
  getBaseUrl: () => "https://subhub.test",
}));
vi.mock("@/lib/settings/service", () => ({
  getSystemSetting: vi.fn(
    async (key: string) =>
      ({
        "system.allowSelfSignup": true,
        "security.invitationExpiryDays": 7,
        "finance.enabledCurrencies": ["AED", "USD"],
      })[key]
  ),
}));
vi.mock("@/lib/licensing", () => ({
  checkLimit: vi.fn(async () => ({ allowed: true, limit: null, used: 0 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    country: { findFirst: vi.fn() },
    currency: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    invitation: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getPasswordPolicy } from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import { checkLimit } from "@/lib/licensing";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import {
  SUPER_ADMIN,
  TENANT_ADMIN,
  TEST_POLICY,
  signInAs,
} from "@/test/platform-session-mock";
import { createTenantWithAdmin, deleteTenant } from "./tenant-lifecycle";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const INPUT = {
  name: "Gulf Logistics",
  domain: "gulf.ae",
  countryCode: "AE",
  baseCurrency: "AED",
  timezone: "Asia/Dubai",
  admin: { name: "Aisha", email: "Aisha@Gulf.ae", method: "invite" as const },
};

function mockTx(orgCount = 0) {
  const tx = {
    $executeRaw: vi.fn(),
    organization: {
      count: vi.fn().mockResolvedValue(orgCount),
      create: vi.fn().mockResolvedValue({ id: "org-new", name: INPUT.name }),
      update: vi.fn(),
    },
    organizationSetting: { createMany: vi.fn() },
    user: { create: vi.fn().mockResolvedValue({ id: "u-new" }) },
    invitation: {
      upsert: vi.fn().mockResolvedValue({ id: "inv-1", token: "tok-1" }),
      updateMany: vi.fn(),
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
  db.country.findFirst.mockResolvedValue({ code: "AE" });
  db.currency.findFirst.mockResolvedValue({ code: "AED" });
  db.organization.findFirst.mockResolvedValue(null);
  db.organization.count.mockResolvedValue(3);
  db.user.findUnique.mockResolvedValue(null);
  db.invitation.findFirst.mockResolvedValue(null);
  vi.mocked(sendInvitationEmail).mockResolvedValue({ success: true } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("createTenantWithAdmin", () => {
  it("denies a tenant ADMIN", async () => {
    signInAs(TENANT_ADMIN);
    const result = await createTenantWithAdmin(INPUT);
    expect(result.success).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("saas: creates the tenant, its defaults and an admin invitation", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    const tx = mockTx(12);
    const result = await createTenantWithAdmin(INPUT);
    expect(result).toMatchObject({
      success: true,
      data: { id: "org-new", admin: { method: "invite", emailSent: true } },
    });
    expect(ensureOrganizationDefaults).toHaveBeenCalledWith("org-new", {
      db: tx,
      countryCode: "AE",
    });
    const settings = tx.organizationSetting.createMany.mock.calls[0][0].data;
    expect(settings.map((r: { key: string }) => r.key)).toEqual([
      "general.countryCode",
      "finance.baseCurrency",
      "general.timezone",
    ]);
    expect(tx.invitation.upsert.mock.calls[0][0].create).toMatchObject({
      email: "aisha@gulf.ae",
      role: "ADMIN",
      organizationId: "org-new",
    });
    const actions = tx.platformAuditLog.create.mock.calls.map(
      (c) => c[0].data.action
    );
    expect(actions).toEqual(["CREATE_TENANT", "INVITE_TENANT_ADMIN"]);
    expect(checkLimit).toHaveBeenCalledWith("maxTenants", 3);
  });

  it("saas: a temporary-password admin must change it and sees the generated password once", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    const tx = mockTx(1);
    const result = await createTenantWithAdmin({
      ...INPUT,
      admin: { ...INPUT.admin, method: "password" },
    });
    expect(result.data?.admin.temporaryPassword).toMatch(/^.{14,}$/);
    expect(tx.user.create.mock.calls[0][0].data).toMatchObject({
      role: "ADMIN",
      organizationId: "org-new",
      mustChangePassword: true,
      passwordHash: "hashed",
    });
  });

  it("keeps the invitation and returns the link when the email cannot be sent", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    mockTx(1);
    vi.mocked(sendInvitationEmail).mockResolvedValue({
      success: false,
    } as never);
    const result = await createTenantWithAdmin(INPUT);
    expect(result.data?.admin).toMatchObject({
      emailSent: false,
      inviteUrl: "https://subhub.test/invite/tok-1",
    });
  });

  it("single-tenant: blocks a second tenant", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    const tx = mockTx(1);
    const result = await createTenantWithAdmin(INPUT);
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/already has an organisation/),
    });
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it("single-tenant: first-run setup creates the installation's organisation", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    const tx = mockTx(0);
    expect((await createTenantWithAdmin(INPUT)).success).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("refuses an inactive country master and a licence-limit breach", async () => {
    db.country.findFirst.mockResolvedValueOnce(null);
    expect((await createTenantWithAdmin(INPUT)).error).toMatch(/country/);
    vi.mocked(checkLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 3,
      used: 3,
      reason: "Licence limit reached",
    });
    expect((await createTenantWithAdmin(INPUT)).error).toBe(
      "Licence limit reached"
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses an admin email that belongs to another tenant", async () => {
    db.user.findUnique.mockResolvedValue({
      organizationId: "org-x",
      role: "ADMIN",
    });
    expect((await createTenantWithAdmin(INPUT)).error).toMatch(
      /another tenant/
    );
  });
});

describe("deleteTenant", () => {
  const ORG = {
    id: "org-1",
    name: "Acme",
    domain: "acme.com",
    deactivatedAt: null,
  };

  it("single-tenant: not available", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    expect(
      (await deleteTenant({ organizationId: "org-1", confirmName: "Acme" }))
        .success
    ).toBe(false);
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("saas: requires the exact tenant name", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    db.organization.findFirst.mockResolvedValue(ORG);
    const result = await deleteTenant({
      organizationId: "org-1",
      confirmName: "acme",
    });
    expect(result.error).toMatch(/exactly/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("saas: soft-deletes, releases the domain and audits", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    db.organization.findFirst.mockResolvedValue(ORG);
    const tx = mockTx();
    expect(
      (await deleteTenant({ organizationId: "org-1", confirmName: " Acme " }))
        .success
    ).toBe(true);
    const data = tx.organization.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.deactivatedAt).toBeInstanceOf(Date);
    expect(data.domain).toBeNull();
    expect(tx.invitation.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DELETE_TENANT" }),
    });
  });

  it("denies a tenant ADMIN", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    signInAs(TENANT_ADMIN);
    expect(
      (await deleteTenant({ organizationId: "org-1", confirmName: "Acme" }))
        .success
    ).toBe(false);
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });
});
