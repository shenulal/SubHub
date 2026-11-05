// src/lib/rbac/service.test.ts
import { getCachedSession } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPermissionKey,
  PERMISSION_KEYS,
  PERMISSIONS,
  SYSTEM_ROLE_TEMPLATES,
} from "./permissions";
import {
  applyPermissionRollouts,
  can,
  ensureOrganizationRoles,
  ForbiddenError,
  getUserPermissionSet,
  hasAll,
  hasAny,
  requirePermission,
} from "./service";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    role: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    permission: { findMany: vi.fn(), upsert: vi.fn() },
    rolePermission: { createMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const session = getCachedSession as unknown as ReturnType<typeof vi.fn>;

describe("permission catalogue", () => {
  it("has unique keys and valid templates", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSIONS.length);
    for (const [role, t] of Object.entries(SYSTEM_ROLE_TEMPLATES)) {
      for (const k of t.grants)
        expect(isPermissionKey(k), `${role}:${k}`).toBe(true);
    }
    expect(SYSTEM_ROLE_TEMPLATES.ADMIN.grants.length).toBe(PERMISSIONS.length);
    expect(SYSTEM_ROLE_TEMPLATES.VIEWER.grants).not.toContain(
      "approvals:decide"
    );
    expect(SYSTEM_ROLE_TEMPLATES.APPROVER.grants).toContain("approvals:decide");
  });
});

describe("getUserPermissionSet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants everything to SUPER_ADMIN", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "SUPER_ADMIN",
      roleId: null,
      organizationId: null,
      customRole: null,
    });
    const set = await getUserPermissionSet("u1", null);
    expect(set.size).toBe(PERMISSIONS.length);
  });

  it("returns nothing for a user outside the organisation", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "ADMIN",
      roleId: null,
      organizationId: "other",
      customRole: null,
    });
    expect((await getUserPermissionSet("u1", "org")).size).toBe(0);
  });

  it("uses the custom role grants when assigned", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "MEMBER",
      roleId: "r1",
      organizationId: "org",
      customRole: {
        organizationId: "org",
        permissions: [{ permission: { key: "reports:read" } }],
      },
    });
    const set = await getUserPermissionSet("u1", "org");
    expect([...set]).toEqual(["reports:read"]);
  });

  it("uses the seeded system role row, else the in-code template", async () => {
    db.user.findUnique.mockResolvedValue({
      role: "VIEWER",
      roleId: null,
      organizationId: "org",
      customRole: null,
    });
    db.role.findFirst.mockResolvedValue({
      permissions: [{ permission: { key: "subscriptions:read" } }],
    });
    expect([...(await getUserPermissionSet("u1", "org"))]).toEqual([
      "subscriptions:read",
    ]);
    db.role.findFirst.mockResolvedValue(null);
    const fallback = await getUserPermissionSet("u2", "org");
    expect(fallback.has("subscriptions:read")).toBe(true);
    expect(fallback.has("settings:manage")).toBe(false);
  });
});

describe("requirePermission / can", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated users and users without an organisation", async () => {
    session.mockResolvedValue(null);
    await expect(requirePermission("subscriptions:read")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    session.mockResolvedValue({
      user: { id: "u1", organizationId: null, role: "MEMBER" },
    });
    await expect(requirePermission("subscriptions:read")).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding"
    );
  });

  it("throws ForbiddenError when the permission is missing and resolves when present", async () => {
    session.mockResolvedValue({
      user: { id: "u1", organizationId: "org", role: "MEMBER" },
    });
    db.user.findUnique.mockResolvedValue({
      role: "MEMBER",
      roleId: null,
      organizationId: "org",
      customRole: null,
    });
    db.role.findFirst.mockResolvedValue(null);
    await expect(requirePermission("settings:manage")).rejects.toBeInstanceOf(
      ForbiddenError
    );
    const ok = await requirePermission("subscriptions:create");
    expect(ok.organizationId).toBe("org");
    expect(await can(["subscriptions:create", "settings:manage"], "any")).toBe(
      true
    );
    expect(await can(["subscriptions:create", "settings:manage"], "all")).toBe(
      false
    );
  });

  it("hasAll / hasAny helpers", () => {
    const set = new Set(["a:b", "c:d"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(hasAll(set, ["a:b", "c:d"] as any)).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(hasAny(set, ["x:y", "c:d"] as any)).toBe(true);
  });
});

describe("ensureOrganizationRoles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the four system roles with template grants when absent", async () => {
    db.permission.findMany.mockResolvedValue(
      PERMISSIONS.map((p, i) => ({ id: `p${i}`, key: p.key }))
    );
    db.role.findUnique.mockResolvedValue(null);
    db.role.create.mockImplementation(
      async ({ data }: { data: { key: string } }) => ({
        id: `role-${data.key}`,
        _count: { permissions: 0 },
      })
    );
    db.rolePermission.createMany.mockResolvedValue({ count: 1 });
    await ensureOrganizationRoles("org");
    expect(db.role.create).toHaveBeenCalledTimes(4);
    expect(db.rolePermission.createMany).toHaveBeenCalledTimes(4);
    const adminCall = db.rolePermission.createMany.mock.calls.find(
      (c: [{ data: { roleId: string }[] }]) =>
        c[0].data[0]?.roleId === "role-ADMIN"
    );
    expect(adminCall[0].data.length).toBe(PERMISSIONS.length);
  });

  it("leaves customised existing roles untouched", async () => {
    db.permission.findMany.mockResolvedValue([
      { id: "p1", key: "subscriptions:read" },
    ]);
    db.role.findUnique.mockResolvedValue({
      id: "r",
      _count: { permissions: 5 },
    });
    await ensureOrganizationRoles("org");
    expect(db.role.create).not.toHaveBeenCalled();
    expect(db.rolePermission.createMany).not.toHaveBeenCalled();
  });
});

describe("applyPermissionRollouts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grants new keys only to system roles whose template includes them", async () => {
    db.permission.findMany.mockResolvedValue([
      { id: "p-global", key: "masters:manage_global" },
    ]);
    db.role.findMany.mockResolvedValue([
      { id: "r-admin", key: "ADMIN" },
      { id: "r-viewer", key: "VIEWER" },
    ]);
    db.rolePermission.createMany.mockResolvedValue({ count: 1 });
    const count = await applyPermissionRollouts("org");
    expect(count).toBe(1);
    expect(db.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org", isSystem: true },
      })
    );
    expect(db.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "r-admin", permissionId: "p-global" }],
      skipDuplicates: true,
    });
  });

  it("is a no-op when the permission row is missing", async () => {
    db.permission.findMany.mockResolvedValue([]);
    db.role.findMany.mockResolvedValue([{ id: "r-admin", key: "ADMIN" }]);
    expect(await applyPermissionRollouts("org")).toBe(0);
    expect(db.rolePermission.createMany).not.toHaveBeenCalled();
  });
});
