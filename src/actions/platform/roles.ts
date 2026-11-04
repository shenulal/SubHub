// src/actions/platform/roles.ts
"use server";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import {
  isPermissionKey,
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";
import { requirePermission } from "@/lib/rbac/service";
import {
  assignRoleSchema,
  roleInputSchema,
  type RoleInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type {
  MemberRoleRow,
  PermissionGroupRow,
  RoleRow,
} from "@/types/platform";
import type { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ActionError, toActionError, writeAudit } from "./_shared";
import {
  permissionGroups,
  queryMembersWithRoles,
  queryRoles,
} from "./roles-query";

const ROLES_PATH = "/settings/roles";
const ADMIN_ROLE: UserRole = "ADMIN";
const CUSTOM_KEY_PREFIX = "custom_";
const MAX_KEY_LENGTH = 48;

export interface RolesPagePayload {
  roles: RoleRow[];
  members: MemberRoleRow[];
  permissionGroups: PermissionGroupRow[];
}

function slugifyKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${CUSTOM_KEY_PREFIX}${slug}`.slice(0, MAX_KEY_LENGTH);
}

async function permissionIdsFor(keys: string[]): Promise<string[]> {
  const unknown = keys.filter((k) => !isPermissionKey(k));
  if (unknown.length)
    throw new ActionError(`Unknown permissions: ${unknown.join(", ")}`);
  const rows = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Admins = members on the system ADMIN role with no custom role override. */
async function countOtherSystemAdmins(
  organizationId: string,
  excludeUserId: string
): Promise<number> {
  return prisma.user.count({
    where: {
      organizationId,
      role: ADMIN_ROLE,
      roleId: null,
      status: "ACTIVE",
      id: { not: excludeUserId },
    },
  });
}

async function _getRolesPage(): Promise<ActionState<RolesPagePayload>> {
  try {
    const { organizationId } = await requirePermission("roles:manage");
    const [roles, members] = await Promise.all([
      queryRoles(organizationId),
      queryMembersWithRoles(organizationId),
    ]);
    return {
      success: true,
      data: { roles, members, permissionGroups: permissionGroups() },
    };
  } catch (error) {
    return toActionError(error, "getRolesPage");
  }
}
export const getRolesPage = withLogging("getRolesPage", _getRolesPage);

async function _createRole(raw: unknown): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } = await requirePermission("roles:manage");
    const input = roleInputSchema.parse(raw);
    const permissionIds = await permissionIdsFor(input.permissionKeys);
    const key = slugifyKey(input.name);
    const clash = await prisma.role.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: { id: true },
    });
    if (clash)
      throw new ActionError("A role with a similar name already exists");
    const created = await prisma.role.create({
      data: {
        organizationId,
        key,
        name: input.name,
        description: input.description ?? null,
        isSystem: false,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_ROLE",
      entityType: "Role",
      entityId: created.id,
      changes: { to: { name: input.name, permissions: input.permissionKeys } },
    });
    revalidatePath(ROLES_PATH);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return toActionError(error, "createRole");
  }
}
export const createRole = withLogging("createRole", _createRole);

async function replaceGrants(roleId: string, permissionIds: string[]) {
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    }),
  ]);
}

async function _updateRole(id: string, raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission("roles:manage");
    const input: RoleInput = roleInputSchema.parse(raw);
    const role = await prisma.role.findFirst({
      where: { id, organizationId },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role) throw new ActionError("Role not found");
    if (role.isSystem)
      throw new ActionError(
        'System role grants can only be restored with "Reset to template"'
      );
    const permissionIds = await permissionIdsFor(input.permissionKeys);
    await prisma.role.update({
      where: { id },
      data: { name: input.name, description: input.description ?? null },
    });
    await replaceGrants(id, permissionIds);
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_ROLE",
      entityType: "Role",
      entityId: id,
      changes: {
        from: {
          name: role.name,
          permissions: role.permissions.map((p) => p.permission.key),
        },
        to: { name: input.name, permissions: input.permissionKeys },
      },
    });
    revalidatePath(ROLES_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateRole");
  }
}
export const updateRole = withLogging("updateRole", _updateRole);

async function _deleteRole(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission("roles:manage");
    const role = await prisma.role.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new ActionError("Role not found");
    if (role.isSystem) throw new ActionError("System roles cannot be deleted");
    await prisma.$transaction([
      prisma.user.updateMany({ where: { roleId: id }, data: { roleId: null } }),
      prisma.role.delete({ where: { id } }),
    ]);
    await writeAudit({
      organizationId,
      userId,
      action: "DELETE_ROLE",
      entityType: "Role",
      entityId: id,
      changes: { from: { name: role.name, members: role._count.users } },
    });
    revalidatePath(ROLES_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "deleteRole");
  }
}
export const deleteRole = withLogging("deleteRole", _deleteRole);

async function _resetSystemRole(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission("roles:manage");
    const role = await prisma.role.findFirst({ where: { id, organizationId } });
    if (!role || !role.isSystem) throw new ActionError("System role not found");
    const template = SYSTEM_ROLE_TEMPLATES[role.key as SystemRoleKey];
    if (!template) throw new ActionError("No template for this role");
    const permissionIds = await permissionIdsFor(template.grants);
    await replaceGrants(id, permissionIds);
    await writeAudit({
      organizationId,
      userId,
      action: "RESET_ROLE_TEMPLATE",
      entityType: "Role",
      entityId: id,
      changes: { to: { permissions: template.grants } },
    });
    revalidatePath(ROLES_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "resetSystemRole");
  }
}
export const resetSystemRole = withLogging("resetSystemRole", _resetSystemRole);

async function _assignMemberRole(raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId: actorId } =
      await requirePermission("roles:manage");
    const { userId, roleId } = assignRoleSchema.parse(raw);
    const member = await prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true, role: true, roleId: true },
    });
    if (!member) throw new ActionError("Member not found");
    if ((member.role as string) === "SUPER_ADMIN")
      throw new ActionError("Super administrators are managed by the platform");

    const target = roleId
      ? await prisma.role.findFirst({ where: { id: roleId, organizationId } })
      : null;
    if (roleId && !target) throw new ActionError("Role not found");

    const wasSystemAdmin = member.role === ADMIN_ROLE && member.roleId === null;
    const staysSystemAdmin = target
      ? target.isSystem && target.legacyRole === ADMIN_ROLE
      : member.role === ADMIN_ROLE;
    if (
      wasSystemAdmin &&
      !staysSystemAdmin &&
      (await countOtherSystemAdmins(organizationId, userId)) === 0
    ) {
      throw new ActionError(
        "Cannot remove the last administrator. Promote another member first."
      );
    }

    const data = target
      ? target.isSystem && target.legacyRole
        ? { role: target.legacyRole, roleId: null }
        : { roleId: target.id }
      : { roleId: null };
    await prisma.user.update({ where: { id: userId }, data });
    await writeAudit({
      organizationId,
      userId: actorId,
      action: "ASSIGN_ROLE",
      entityType: "User",
      entityId: userId,
      changes: {
        from: { role: member.role, roleId: member.roleId },
        to: { role: data.role ?? member.role, roleId: data.roleId ?? null },
      },
    });
    revalidatePath(ROLES_PATH);
    revalidatePath("/settings/team");
    return { success: true };
  } catch (error) {
    return toActionError(error, "assignMemberRole");
  }
}
export const assignMemberRole = withLogging(
  "assignMemberRole",
  _assignMemberRole
);
