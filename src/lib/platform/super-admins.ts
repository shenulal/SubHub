// src/lib/platform/super-admins.ts
/**
 * Create / reset platform super admins. Shared by the bootstrap CLI
 * (`npm run platform:create-super-admin`) and the Control Panel actions, so the
 * identity rules live in one place. Takes the Prisma client as a parameter.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { SUPER_ADMIN_ROLE } from "./identity";

type Db = Prisma.TransactionClient | PrismaClient;

export class SuperAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperAdminError";
  }
}

export const LAST_SUPER_ADMIN_MESSAGE =
  "At least one active platform super admin must remain.";

export const TENANT_EMAIL_MESSAGE =
  "This email belongs to a tenant user. Platform super admins must use an address that is not a member of any tenant.";

export interface UpsertSuperAdminInput {
  email: string;
  name: string;
  passwordHash: string;
  /** Force a password change at next sign-in (temporary password). */
  mustChangePassword?: boolean;
}

export interface UpsertSuperAdminResult {
  id: string;
  email: string;
  created: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a super admin, or reset an existing one (name, password, re-enable).
 * Refuses an email that belongs to a tenant user instead of silently moving it.
 */
export async function upsertSuperAdmin(
  db: Db,
  input: UpsertSuperAdminInput
): Promise<UpsertSuperAdminResult> {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, organizationId: true },
  });
  if (
    existing &&
    (existing.role !== SUPER_ADMIN_ROLE || existing.organizationId)
  ) {
    throw new SuperAdminError(TENANT_EMAIL_MESSAGE);
  }
  const data = {
    name: input.name,
    passwordHash: input.passwordHash,
    status: "ACTIVE" as const,
    emailVerified: new Date(),
    mustChangePassword: input.mustChangePassword ?? false,
    failedLoginAttempts: 0,
    lockedUntil: null,
  };
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data });
    return { id: existing.id, email, created: false };
  }
  const created = await db.user.create({
    data: { ...data, email, role: SUPER_ADMIN_ROLE, organizationId: null },
    select: { id: true },
  });
  return { id: created.id, email, created: true };
}

/** Active super admins other than `excludeId` (last-admin guard). */
export async function countOtherActiveSuperAdmins(
  db: Db,
  excludeId: string
): Promise<number> {
  return db.user.count({
    where: {
      role: SUPER_ADMIN_ROLE,
      organizationId: null,
      status: "ACTIVE",
      id: { not: excludeId },
    },
  });
}
