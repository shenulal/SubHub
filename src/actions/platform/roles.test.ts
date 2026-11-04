import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignMemberRole, createRole, deleteRole, updateRole } from "./roles";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    role: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    permission: { findMany: vi.fn() },
    rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) =>
      typeof ops === "function" ? (ops as () => unknown)() : ops
    ),
  },
}));
vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/rbac/service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rbac/service")>(
      "@/lib/rbac/service"
    );
  return {
    ...actual,
    requirePermission: vi.fn(),
    ensureOrganizationRoles: vi.fn(),
  };
});
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const ctx = { organizationId: "org-1", userId: "actor" };
const adminRole = {
  id: "role-admin",
  organizationId: "org-1",
  isSystem: true,
  legacyRole: "ADMIN",
  key: "ADMIN",
  name: "Administrator",
};
const customRole = {
  id: "role-custom",
  organizationId: "org-1",
  isSystem: false,
  legacyRole: null,
  key: "custom_fin",
  name: "Finance",
};

describe("assignMemberRole — last admin guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
  });

  it("blocks demoting the only system administrator", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      roleId: null,
    } as never);
    vi.mocked(prisma.role.findFirst).mockResolvedValue(customRole as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const result = await assignMemberRole({
      userId: "u1",
      roleId: "role-custom",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/last administrator/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("allows demotion when another administrator remains and audits it", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      roleId: null,
    } as never);
    vi.mocked(prisma.role.findFirst).mockResolvedValue(customRole as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    const result = await assignMemberRole({
      userId: "u1",
      roleId: "role-custom",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { roleId: "role-custom" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ASSIGN_ROLE" }),
      })
    );
  });

  it("assigning a system role sets the legacy enum and clears the custom role", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u2",
      role: "MEMBER",
      roleId: "role-custom",
    } as never);
    vi.mocked(prisma.role.findFirst).mockResolvedValue(adminRole as never);

    const result = await assignMemberRole({
      userId: "u2",
      roleId: "role-admin",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u2" },
      data: { role: "ADMIN", roleId: null },
    });
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it("clearing the role keeps an admin an admin without the guard firing", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      roleId: null,
    } as never);
    const result = await assignMemberRole({ userId: "u1", roleId: null });
    expect(result.success).toBe(true);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it("rejects members outside the organisation and super admins", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
    expect(
      (await assignMemberRole({ userId: "ghost", roleId: null })).success
    ).toBe(false);
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
      id: "sa",
      role: "SUPER_ADMIN",
      roleId: null,
    } as never);
    expect(
      (await assignMemberRole({ userId: "sa", roleId: null })).success
    ).toBe(false);
  });
});

describe("custom role CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(ctx as never);
    vi.mocked(prisma.permission.findMany).mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ] as never);
  });

  it("creates a custom role with a slug key and its grants", async () => {
    vi.mocked(prisma.role.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.role.create).mockResolvedValue({ id: "new" } as never);
    const result = await createRole({
      name: "Finance Ops",
      description: null,
      permissionKeys: ["payments:read", "budgets:manage"],
    });
    expect(result).toMatchObject({ success: true, data: { id: "new" } });
    const data = vi.mocked(prisma.role.create).mock.calls[0][0].data;
    expect(data.key).toBe("custom_finance_ops");
    expect(data.permissions).toEqual({
      create: [{ permissionId: "p1" }, { permissionId: "p2" }],
    });
  });

  it("rejects unknown permission keys", async () => {
    const result = await createRole({
      name: "X",
      permissionKeys: ["nope:nothing"],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown permissions/);
  });

  it("refuses to edit or delete system roles", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      ...adminRole,
      permissions: [],
    } as never);
    expect(
      (await updateRole("role-admin", { name: "Admin", permissionKeys: [] }))
        .success
    ).toBe(false);
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      ...adminRole,
      _count: { users: 1 },
    } as never);
    expect((await deleteRole("role-admin")).success).toBe(false);
  });

  it("deletes a custom role and detaches its members", async () => {
    vi.mocked(prisma.role.findFirst).mockResolvedValue({
      ...customRole,
      _count: { users: 2 },
    } as never);
    const result = await deleteRole("role-custom");
    expect(result.success).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { roleId: "role-custom" },
      data: { roleId: null },
    });
    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { id: "role-custom" },
    });
  });
});
