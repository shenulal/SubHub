// src/actions/super-admin/tenant-settings.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ requireSuperAdmin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    platformAuditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/masters/organization-defaults", () => ({
  ensureOrganizationDefaults: vi.fn(),
}));
vi.mock("@/lib/settings/service", () => ({ getSystemSetting: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import {
  createTenant,
  getTenantInfo,
  setTenantActive,
} from "./tenant-settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const ROW = {
  id: "org-new",
  name: "Acme",
  domain: "acme.com",
  logoUrl: null,
  createdAt: new Date("2026-11-01"),
  deactivatedAt: null,
  _count: { users: 0, subscriptions: 0 },
};

function mockTransaction(orgCount: number) {
  const tx = {
    $executeRaw: vi.fn(),
    organization: {
      count: vi.fn().mockResolvedValue(orgCount),
      create: vi.fn().mockResolvedValue({ id: "org-new" }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(ROW),
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
  vi.mocked(requireSuperAdmin).mockResolvedValue({
    userId: "sa-1",
    role: "SUPER_ADMIN",
  } as never);
  db.organization.findFirst.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("createTenant", () => {
  it("single-tenant: refuses a second organisation", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    const tx = mockTransaction(1);
    const result = await createTenant("Acme", "acme.com");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already has an organisation/);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it("single-tenant: creates the first organisation with defaults", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    const tx = mockTransaction(0);
    const result = await createTenant("Acme", "acme.com");
    expect(result.success).toBe(true);
    expect(ensureOrganizationDefaults).toHaveBeenCalledWith("org-new", {
      db: tx,
    });
  });

  it("saas: creates another tenant and audits it on the platform log", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    const tx = mockTransaction(12);
    const result = await createTenant("Acme", "ACME.com");
    expect(result).toMatchObject({ success: true, data: { id: "org-new" } });
    expect(tx.organization.create).toHaveBeenCalledWith({
      data: { name: "Acme", domain: "acme.com", logoUrl: null },
      select: { id: true },
    });
    expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "sa-1",
        action: "CREATE_TENANT",
        entityId: "org-new",
      }),
    });
  });

  it("refuses a domain that another tenant uses", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    db.organization.findFirst.mockResolvedValue({ id: "taken" });
    expect(await createTenant("Acme", "acme.com")).toEqual({
      success: false,
      message: "This domain is already in use",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("getTenantInfo", () => {
  it("saas: requires an explicit tenant", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    expect(await getTenantInfo()).toEqual({
      success: false,
      message: "Select a tenant.",
    });
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("single-tenant: falls back to the installation's organisation", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    db.organization.findFirst.mockResolvedValue({ id: "org-1", name: "QA" });
    db.organization.findUnique.mockResolvedValue({ ...ROW, id: "org-1" });
    expect(await getTenantInfo()).toMatchObject({
      success: true,
      data: { id: "org-1", userCount: 0 },
    });
  });
});

describe("setTenantActive", () => {
  it("single-tenant: deactivation is not available", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    const result = await setTenantActive("org-1", false);
    expect(result.success).toBe(false);
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("saas: deactivates and reactivates with an audit entry", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    db.organization.findUnique.mockResolvedValueOnce({ deactivatedAt: null });
    expect(await setTenantActive("org-1", false)).toMatchObject({
      success: true,
    });
    const call = db.organization.update.mock.calls[0][0];
    expect(call.data.deactivatedAt).toBeInstanceOf(Date);
    expect(db.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DEACTIVATE_TENANT" }),
    });

    db.organization.findUnique.mockResolvedValueOnce({
      deactivatedAt: new Date(),
    });
    expect(await setTenantActive("org-1", true)).toMatchObject({
      success: true,
    });
    expect(db.organization.update.mock.calls[1][0].data).toEqual({
      deactivatedAt: null,
    });
  });
});
