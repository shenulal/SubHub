// src/actions/super-admin/tenants.test.ts
// Read side of the Control Panel: tenant directory, tenant detail, audit log, licence.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
vi.mock("@/lib/logging", () => ({
  withLogging: (_n: string, fn: unknown) => fn,
}));
vi.mock("@/lib/settings/service", () => ({
  getSettings: vi.fn(async () => ({
    "general.countryCode": "AE",
    "finance.baseCurrency": "AED",
    "general.timezone": "Asia/Dubai",
  })),
  getSystemSetting: vi.fn(async () => 25),
}));
vi.mock("@/lib/licensing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/licensing")>()),
  getInstallationId: vi.fn(async () => "inst-1"),
}));
vi.mock("@/lib/licensing/installation", () => ({
  getInstallationId: vi.fn(async () => "inst-1"),
}));
vi.mock("@/lib/db", () => {
  const count = () => vi.fn().mockResolvedValue(0);
  return {
    prisma: {
      organization: { findMany: vi.fn(), findFirst: vi.fn(), count: count() },
      user: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        aggregate: vi.fn(),
        count: count(),
      },
      subscription: { count: count() },
      app: { count: count() },
      team: { count: count() },
      integration: { count: count() },
      invitation: { findMany: vi.fn() },
      platformAuditLog: { findMany: vi.fn(), count: count() },
    },
  };
});

import { prisma } from "@/lib/db";
import {
  SUPER_ADMIN,
  TENANT_ADMIN,
  signInAs,
} from "@/test/platform-session-mock";
import { listPlatformAudit } from "./audit";
import { getLicenceOverview } from "./licence";
import { getTenantDetail, listTenantDirectory } from "./tenants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  signInAs(SUPER_ADMIN);
  db.user.groupBy.mockResolvedValue([]);
  db.user.findMany.mockResolvedValue([]);
  db.user.aggregate.mockResolvedValue({ _max: { lastLoginAt: null } });
  db.invitation.findMany.mockResolvedValue([]);
  db.platformAuditLog.findMany.mockResolvedValue([]);
  db.organization.findMany.mockResolvedValue([]);
});

describe("listTenantDirectory", () => {
  it("denies a tenant ADMIN", async () => {
    signInAs(TENANT_ADMIN);
    expect((await listTenantDirectory()).success).toBe(false);
    expect(db.organization.findMany).not.toHaveBeenCalled();
  });

  it("filters out deleted tenants and applies search + status", async () => {
    db.organization.findMany.mockResolvedValue([
      {
        id: "o1",
        name: "Acme",
        domain: null,
        createdAt: new Date(),
        deactivatedAt: null,
        _count: { users: 4, subscriptions: 2 },
      },
    ]);
    db.user.groupBy
      .mockResolvedValueOnce([
        { organizationId: "o1", _max: { lastLoginAt: new Date("2026-11-05") } },
      ])
      .mockResolvedValueOnce([{ organizationId: "o1", _count: { _all: 2 } }]);
    const result = await listTenantDirectory({
      search: "ac",
      status: "suspended",
    });
    const where = db.organization.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      deletedAt: null,
      deactivatedAt: { not: null },
    });
    expect(where.OR[0].name).toEqual({ contains: "ac", mode: "insensitive" });
    expect(result.data?.[0]).toMatchObject({
      userCount: 4,
      adminCount: 2,
      lastActivityAt: new Date("2026-11-05"),
    });
  });
});

describe("getTenantDetail", () => {
  it("returns not found for a deleted or unknown tenant", async () => {
    db.organization.findFirst.mockResolvedValue(null);
    expect((await getTenantDetail("gone")).success).toBe(false);
    expect(db.organization.findFirst.mock.calls[0][0].where).toEqual({
      id: "gone",
      deletedAt: null,
    });
  });

  it("assembles usage, defaults, licence limits and tenant audit", async () => {
    db.organization.findFirst.mockResolvedValue({
      id: "o1",
      name: "Acme",
      domain: null,
      logoUrl: null,
      createdAt: new Date(),
      deactivatedAt: null,
    });
    db.user.groupBy.mockResolvedValue([{ role: "ADMIN", _count: { _all: 1 } }]);
    const result = await getTenantDetail("o1");
    expect(result.data).toMatchObject({
      usersByRole: [{ role: "ADMIN", count: 1 }],
      defaults: {
        countryCode: "AE",
        baseCurrency: "AED",
        timezone: "Asia/Dubai",
      },
      licence: { edition: "community", maxUsersPerTenant: null },
    });
    expect(
      JSON.stringify(db.platformAuditLog.findMany.mock.calls[0][0].where)
    ).toContain("organizationId");
  });
});

describe("listPlatformAudit", () => {
  it("builds the filters and paginates with the platform page size", async () => {
    db.platformAuditLog.count.mockResolvedValue(30);
    const result = await listPlatformAudit({
      action: "CREATE_TENANT",
      from: "2026-11-01",
      to: "2026-11-06",
      page: "2",
    });
    const args = db.platformAuditLog.findMany.mock.calls[0][0];
    expect(args.skip).toBe(25);
    expect(args.take).toBe(25);
    expect(args.where.AND[0]).toEqual({ action: "CREATE_TENANT" });
    expect(result.data).toMatchObject({ total: 30, page: 2, pageSize: 25 });
  });

  it("rejects malformed filters", async () => {
    expect((await listPlatformAudit({ action: "drop table" })).success).toBe(
      false
    );
  });

  it("denies a tenant ADMIN", async () => {
    signInAs(TENANT_ADMIN);
    expect((await listPlatformAudit()).success).toBe(false);
  });
});

describe("getLicenceOverview", () => {
  it("shows the community licence with the installation id", async () => {
    db.organization.count.mockResolvedValue(2);
    db.user.groupBy.mockResolvedValue([
      { organizationId: "o1", _count: { _all: 7 } },
    ]);
    const result = await getLicenceOverview();
    expect(result.data).toMatchObject({
      providerId: "community",
      installationId: "inst-1",
      usage: { tenants: 2, largestTenantUsers: 7 },
      expired: false,
    });
  });
});
