// src/lib/rbac/service.ts
/**
 * RBAC service — resolves a user's effective permission set and enforces it on the
 * server (server actions, API routes). UI gating uses the same set through
 * `/api/v1/me/permissions` and the `usePermissions` hook.
 *
 * Resolution:
 *   SUPER_ADMIN            → every permission
 *   user.roleId (custom)   → that role's grants
 *   user.role (legacy enum)→ the organisation's system role with legacyRole = role,
 *                            or the in-code template if the row does not exist yet
 *
 * Deployment mode (`SUBHUB_DEPLOYMENT_MODE`): in SaaS mode the platform-only keys
 * (`PLATFORM_PERMISSION_KEYS`) are stripped from every tenant role, so neither
 * system nor custom roles can grant cross-tenant writes. A deactivated
 * organisation resolves to an empty set.
 */
import { getCachedSession } from "@/lib/auth/require-auth";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/sign-in-codes";
import { prisma } from "@/lib/db";
import { isSaas } from "@/lib/deployment/mode";
import { homeForUserWithoutOrganization } from "@/lib/platform/identity";
import type { Prisma, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  isPlatformPermission,
  PERMISSION_KEYS,
  PERMISSION_ROLLOUTS,
  PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  SYSTEM_ROLE_TEMPLATES,
  type PermissionKey,
  type SystemRoleKey,
} from "./permissions";

export class ForbiddenError extends Error {
  constructor(
    public readonly permission: string | string[],
    message = "You do not have permission to perform this action"
  ) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof ForbiddenError;
}

type Db = Prisma.TransactionClient | typeof prisma;

/** SaaS: drop platform-only keys from a tenant permission set (returns a new set). */
export function scopeToDeployment(keys: Iterable<string>): Set<string> {
  const list = Array.from(keys);
  return new Set(
    isSaas() ? list.filter((k) => !isPlatformPermission(k)) : list
  );
}

/**
 * Effective permission keys for a user inside an organisation.
 */
export const getUserPermissionSet = cache(
  async (
    userId: string,
    organizationId: string | null
  ): Promise<Set<string>> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        roleId: true,
        organizationId: true,
        organization: { select: { deactivatedAt: true } },
        customRole: {
          select: {
            organizationId: true,
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    if (!user) return new Set();
    if ((user.role as string) === "SUPER_ADMIN")
      return new Set(PERMISSION_KEYS);
    if (!organizationId || user.organizationId !== organizationId)
      return new Set();
    if (user.organization?.deactivatedAt) return new Set();

    if (user.customRole && user.customRole.organizationId === organizationId) {
      return scopeToDeployment(
        user.customRole.permissions.map((rp) => rp.permission.key)
      );
    }

    const legacy = user.role as SystemRoleKey;
    const systemRole = await prisma.role.findFirst({
      where: { organizationId, legacyRole: legacy as UserRole, isSystem: true },
      select: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (systemRole) {
      return scopeToDeployment(
        systemRole.permissions.map((rp) => rp.permission.key)
      );
    }
    return scopeToDeployment(SYSTEM_ROLE_TEMPLATES[legacy]?.grants ?? []);
  }
);

export function hasAll(
  set: Set<string>,
  needed: PermissionKey | PermissionKey[]
) {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.every((k) => set.has(k));
}

export function hasAny(
  set: Set<string>,
  needed: PermissionKey | PermissionKey[]
) {
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((k) => set.has(k));
}

/**
 * Current-session permission check (no redirect, no throw).
 */
export async function can(
  permission: PermissionKey | PermissionKey[],
  mode: "all" | "any" = "all"
): Promise<boolean> {
  const session = await getCachedSession();
  if (!session?.user) return false;
  const set = await getUserPermissionSet(
    session.user.id,
    session.user.organizationId ?? null
  );
  return mode === "all" ? hasAll(set, permission) : hasAny(set, permission);
}

export interface RequirePermissionResult {
  userId: string;
  organizationId: string;
  role: UserRole;
  permissions: Set<string>;
}

/**
 * Server-side guard for server actions and route handlers.
 * Throws `ForbiddenError` (callers map it to ActionState / 403).
 */
export async function requirePermission(
  permission: PermissionKey | PermissionKey[],
  options: { mode?: "all" | "any" } = {}
): Promise<RequirePermissionResult> {
  const session = await getCachedSession();
  if (!session?.user) redirect("/login");
  if (session.user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
  if (!session.user.organizationId)
    redirect(homeForUserWithoutOrganization(session.user.role as string));
  const permissions = await getUserPermissionSet(
    session.user.id,
    session.user.organizationId
  );
  const ok =
    (options.mode ?? "all") === "all"
      ? hasAll(permissions, permission)
      : hasAny(permissions, permission);
  if (!ok) throw new ForbiddenError(permission);
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    permissions,
  };
}

export interface PlatformActor {
  userId: string;
  /** Null for a SUPER_ADMIN acting from the platform console. */
  organizationId: string | null;
  isSuperAdmin: boolean;
  permissions: Set<string>;
}

/**
 * Guard for actions on platform-wide data (currencies, countries, vendor catalog)
 * that the super-admin console also calls. SUPER_ADMIN passes without an
 * organisation; everyone else goes through `requirePermission` (which, in SaaS
 * mode, never grants platform-only keys to tenant users).
 */
export async function requirePlatformActor(
  permission: PermissionKey | PermissionKey[],
  options: { mode?: "all" | "any" } = {}
): Promise<PlatformActor> {
  const session = await getCachedSession();
  if (!session?.user) redirect("/login");
  if ((session.user.role as string) === "SUPER_ADMIN") {
    return {
      userId: session.user.id,
      organizationId: session.user.organizationId ?? null,
      isSuperAdmin: true,
      permissions: new Set(PERMISSION_KEYS),
    };
  }
  const result = await requirePermission(permission, options);
  return {
    userId: result.userId,
    organizationId: result.organizationId,
    isSuperAdmin: false,
    permissions: result.permissions,
  };
}

/**
 * Page-level guard: redirects instead of throwing.
 */
export async function requirePermissionOrRedirect(
  permission: PermissionKey | PermissionKey[],
  redirectTo = "/dashboard",
  options: { mode?: "all" | "any" } = {}
): Promise<RequirePermissionResult> {
  try {
    return await requirePermission(permission, options);
  } catch (error) {
    if (isForbiddenError(error)) redirect(redirectTo);
    throw error;
  }
}

/**
 * Upsert the global permission catalogue (idempotent).
 */
export async function ensurePermissionCatalog(
  db: Db = prisma
): Promise<number> {
  for (const def of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: def.key },
      create: {
        key: def.key,
        resource: def.resource,
        action: def.action,
        group: def.group,
        description: def.description,
      },
      update: {
        resource: def.resource,
        action: def.action,
        group: def.group,
        description: def.description,
      },
    });
  }
  return PERMISSIONS.length;
}

/**
 * Create the four system roles for an organisation with their default grants.
 * Safe to call repeatedly; existing roles keep any admin customisation.
 */
export async function ensureOrganizationRoles(
  organizationId: string,
  db: Db = prisma
): Promise<void> {
  const permissionRows = await db.permission.findMany({
    select: { id: true, key: true },
  });
  if (permissionRows.length === 0) {
    await ensurePermissionCatalog(db);
  }
  const byKey = new Map(
    (await db.permission.findMany({ select: { id: true, key: true } })).map(
      (r) => [r.key, r.id]
    )
  );

  for (const key of SYSTEM_ROLE_KEYS) {
    const template = SYSTEM_ROLE_TEMPLATES[key];
    const existing = await db.role.findUnique({
      where: { organizationId_key: { organizationId, key } },
      select: { id: true, _count: { select: { permissions: true } } },
    });
    const role =
      existing ??
      (await db.role.create({
        data: {
          organizationId,
          key,
          name: template.name,
          description: template.description,
          isSystem: true,
          isDefault: key === "MEMBER",
          legacyRole: key as UserRole,
        },
        select: { id: true, _count: { select: { permissions: true } } },
      }));
    if (role._count.permissions === 0) {
      const grants = template.grants
        .map((k) => byKey.get(k))
        .filter((id): id is string => Boolean(id));
      if (grants.length) {
        await db.rolePermission.createMany({
          data: grants.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
}

/**
 * Re-sync the keys in `PERMISSION_ROLLOUTS` on an organisation's existing system
 * roles to the role templates: grant where the template includes the key,
 * revoke where it does not. Custom roles are untouched. Idempotent; returns the
 * number of grants written plus grants removed.
 */
export async function applyPermissionRollouts(
  organizationId: string,
  db: Db = prisma
): Promise<number> {
  if (PERMISSION_ROLLOUTS.length === 0) return 0;
  const [permissionRows, roles] = await Promise.all([
    db.permission.findMany({
      where: { key: { in: [...PERMISSION_ROLLOUTS] } },
      select: { id: true, key: true },
    }),
    db.role.findMany({
      where: { organizationId, isSystem: true },
      select: { id: true, key: true },
    }),
  ]);
  const idByKey = new Map(permissionRows.map((r) => [r.key, r.id]));
  const grants: { roleId: string; permissionId: string }[] = [];
  const revokes: { roleId: string; permissionId: string }[] = [];
  for (const role of roles) {
    const template = SYSTEM_ROLE_TEMPLATES[role.key as SystemRoleKey];
    if (!template) continue;
    for (const key of PERMISSION_ROLLOUTS) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      const target = template.grants.includes(key) ? grants : revokes;
      target.push({ roleId: role.id, permissionId });
    }
  }
  const granted = grants.length
    ? (
        await db.rolePermission.createMany({
          data: grants,
          skipDuplicates: true,
        })
      ).count
    : 0;
  const revoked = revokes.length
    ? (await db.rolePermission.deleteMany({ where: { OR: revokes } })).count
    : 0;
  return granted + revoked;
}
