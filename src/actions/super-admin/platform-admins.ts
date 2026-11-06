// src/actions/super-admin/platform-admins.ts
"use server";

/**
 * Control Panel — platform super administrators (SUPER_ADMIN, no organisation):
 * list, add, disable / enable, reset password. At least one active super admin
 * must always remain. Every change is written to the platform audit log.
 */
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { PlatformAdminActor } from "@/lib/platform/guard";
import { SUPER_ADMIN_ROLE } from "@/lib/platform/identity";
import {
  resolveTemporaryPassword,
  temporaryPasswordUpdate,
} from "@/lib/platform/passwords";
import {
  countOtherActiveSuperAdmins,
  LAST_SUPER_ADMIN_MESSAGE,
  normalizeEmail,
  SuperAdminError,
  upsertSuperAdmin,
} from "@/lib/platform/super-admins";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformAction } from "./_action";

export interface PlatformAdminRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  isCurrentUser: boolean;
}

const PLATFORM_ADMIN_WHERE = {
  role: SUPER_ADMIN_ROLE,
  organizationId: null,
} satisfies Prisma.UserWhereInput;

/** Serialises disable operations so two cannot remove the last active admin. */
const LAST_ADMIN_LOCK = 4_2026_1107;

const revalidate = () => revalidatePath("/super-admin/platform-admins");

async function _listPlatformAdmins(
  actor: PlatformAdminActor
): Promise<ActionState<PlatformAdminRow[]>> {
  const rows = await prisma.user.findMany({
    where: PLATFORM_ADMIN_WHERE,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  return {
    success: true,
    data: rows.map((r) => ({ ...r, isCurrentUser: r.id === actor.userId })),
  };
}

export const listPlatformAdmins = platformAction(
  "listPlatformAdmins",
  _listPlatformAdmins
);

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().max(72).optional(),
});

async function _createPlatformAdmin(
  actor: PlatformAdminActor,
  raw: z.input<typeof createSchema>
): Promise<ActionState<{ id: string; temporaryPassword?: string }>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };
  const email = normalizeEmail(parsed.data.email);
  const exists = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (exists)
    return {
      success: false,
      error: "An account with this email already exists.",
    };
  const password = await resolveTemporaryPassword(parsed.data.password, null);
  if (!password.ok) return { success: false, error: password.message };
  try {
    const created = await prisma.$transaction(async (tx) => {
      const result = await upsertSuperAdmin(tx, {
        email,
        name: parsed.data.name,
        passwordHash: await hashPassword(password.password),
        mustChangePassword: true,
      });
      await writePlatformAudit(
        {
          actorId: actor.userId,
          action: "CREATE_SUPER_ADMIN",
          entityType: "User",
          entityId: result.id,
          changes: { email, name: parsed.data.name },
        },
        tx
      );
      return result;
    });
    revalidate();
    return {
      success: true,
      message:
        "Platform admin added. They must change the password at the first sign-in.",
      data: {
        id: created.id,
        ...(password.generated ? { temporaryPassword: password.password } : {}),
      },
    };
  } catch (error) {
    if (error instanceof SuperAdminError)
      return { success: false, error: error.message };
    throw error;
  }
}

export const createPlatformAdmin = platformAction(
  "createPlatformAdmin",
  _createPlatformAdmin
);

const idSchema = z.object({ userId: z.string().min(1) });

async function findPlatformAdmin(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, ...PLATFORM_ADMIN_WHERE },
    select: {
      id: true,
      email: true,
      status: true,
      passwordHash: true,
      passwordHistory: true,
    },
  });
}

async function _setPlatformAdminActive(
  actor: PlatformAdminActor,
  raw: { userId: string; active: boolean }
): Promise<ActionState> {
  const parsed = idSchema.extend({ active: z.boolean() }).safeParse(raw);
  if (!parsed.success)
    return { success: false, error: "Select a platform admin." };
  const { userId, active } = parsed.data;
  const target = await findPlatformAdmin(userId);
  if (!target) return { success: false, error: "Platform admin not found." };
  if (!active && target.id === actor.userId) {
    return { success: false, error: "You cannot disable your own account." };
  }
  const status = active ? "ACTIVE" : "INACTIVE";
  const ok = await prisma.$transaction(async (tx) => {
    if (!active) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LAST_ADMIN_LOCK})`;
      if ((await countOtherActiveSuperAdmins(tx, target.id)) === 0)
        return false;
    }
    await tx.user.update({ where: { id: target.id }, data: { status } });
    await writePlatformAudit(
      {
        actorId: actor.userId,
        action: active ? "ENABLE_SUPER_ADMIN" : "DISABLE_SUPER_ADMIN",
        entityType: "User",
        entityId: target.id,
        changes: {
          email: target.email,
          status: { from: target.status, to: status },
        },
      },
      tx
    );
    return true;
  });
  if (!ok) return { success: false, error: LAST_SUPER_ADMIN_MESSAGE };
  revalidate();
  return {
    success: true,
    message: active ? "Platform admin enabled." : "Platform admin disabled.",
  };
}

export const setPlatformAdminActive = platformAction(
  "setPlatformAdminActive",
  _setPlatformAdminActive
);

async function _resetPlatformAdminPassword(
  actor: PlatformAdminActor,
  raw: { userId: string; password?: string }
): Promise<ActionState<{ temporaryPassword?: string }>> {
  const parsed = idSchema
    .extend({ password: z.string().max(72).optional() })
    .safeParse(raw);
  if (!parsed.success)
    return { success: false, error: "Select a platform admin." };
  const target = await findPlatformAdmin(parsed.data.userId);
  if (!target) return { success: false, error: "Platform admin not found." };
  const password = await resolveTemporaryPassword(
    parsed.data.password,
    null,
    target
  );
  if (!password.ok) return { success: false, error: password.message };
  const isSelf = target.id === actor.userId;
  const data = await temporaryPasswordUpdate(
    password.password,
    target,
    null,
    !isSelf
  );
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data });
    await writePlatformAudit(
      {
        actorId: actor.userId,
        action: "RESET_SUPER_ADMIN_PASSWORD",
        entityType: "User",
        entityId: target.id,
        changes: { email: target.email, mustChangePassword: !isSelf },
      },
      tx
    );
  });
  revalidate();
  return {
    success: true,
    message: isSelf
      ? "Your password was changed."
      : "Temporary password set. It must be changed at the next sign-in.",
    data: password.generated ? { temporaryPassword: password.password } : {},
  };
}

export const resetPlatformAdminPassword = platformAction(
  "resetPlatformAdminPassword",
  _resetPlatformAdminPassword
);
