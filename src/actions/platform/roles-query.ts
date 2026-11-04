// src/actions/platform/roles-query.ts
/**
 * Role read helpers shared by the roles server actions and `/api/v1/roles`.
 */
import { prisma } from "@/lib/db";
import { permissionsByGroup } from "@/lib/rbac/permissions";
import { ensureOrganizationRoles } from "@/lib/rbac/service";
import type {
  MemberRoleRow,
  PermissionGroupRow,
  RoleRow,
} from "@/types/platform";

/** Members on a system role = legacy enum users with no custom role assigned. */
export async function queryRoles(organizationId: string): Promise<RoleRow[]> {
  await ensureOrganizationRoles(organizationId);
  const [roles, legacyCounts] = await Promise.all([
    prisma.role.findMany({
      where: { organizationId },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        _count: { select: { users: true } },
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { organizationId, roleId: null, status: { not: "TERMINATED" } },
      _count: { _all: true },
    }),
  ]);
  const legacy = new Map(
    legacyCounts.map((r) => [r.role as string, r._count._all])
  );
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    isDefault: r.isDefault,
    legacyRole: r.legacyRole,
    memberCount:
      r.isSystem && r.legacyRole
        ? (legacy.get(r.legacyRole) ?? 0)
        : r._count.users,
    permissionKeys: r.permissions.map((p) => p.permission.key).sort(),
  }));
}

export async function queryMembersWithRoles(
  organizationId: string
): Promise<MemberRoleRow[]> {
  const users = await prisma.user.findMany({
    where: { organizationId, status: { not: "TERMINATED" } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roleId: true,
      status: true,
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    systemRole: u.role,
    customRoleId: u.roleId,
    status: u.status,
  }));
}

export function permissionGroups(): PermissionGroupRow[] {
  return Object.entries(permissionsByGroup()).map(([group, defs]) => ({
    group,
    permissions: defs.map((d) => ({ key: d.key, description: d.description })),
  }));
}
