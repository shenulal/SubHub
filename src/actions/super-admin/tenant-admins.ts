// src/actions/super-admin/tenant-admins.ts
"use server";

/**
 * Control Panel — Tenant Admin management that works in both deployment modes:
 * add another admin (invitation or temporary password) and reset an admin's
 * password (temporary, must be changed at the next sign-in).
 */
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { PlatformAdminActor } from "@/lib/platform/guard";
import {
  resolveTemporaryPassword,
  temporaryPasswordUpdate,
} from "@/lib/platform/passwords";
import { getSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformAction } from "./_action";
import {
  adminEmailConflict,
  deliverAdminInvitation,
  invitationExpiry,
  provisionTenantAdmin,
  resolveAdminPassword,
  tenantAdminSchema,
  type ProvisionedAdmin,
} from "./_tenant-admin";

const addSchema = tenantAdminSchema.extend({
  organizationId: z.string().min(1),
});

async function activeTenant(organizationId: string) {
  return prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
}

function revalidateTenant(organizationId: string) {
  revalidatePath(`/super-admin/tenants/${organizationId}`);
  revalidatePath("/super-admin/installation");
  revalidatePath("/super-admin/admins");
}

async function _addTenantAdmin(
  actor: PlatformAdminActor,
  raw: z.input<typeof addSchema>
): Promise<ActionState<ProvisionedAdmin>> {
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check your input",
    };
  }
  const { organizationId, ...admin } = parsed.data;
  const org = await activeTenant(organizationId);
  if (!org) return { success: false, error: "Tenant information not found." };
  const conflict = await adminEmailConflict(admin.email, org.id, admin.method);
  if (conflict) return { success: false, error: conflict };

  const [password, invitationDays] = await Promise.all([
    resolveAdminPassword(admin, org.id),
    getSetting(org.id, "security.invitationExpiryDays"),
  ]);
  if (!password.ok) return { success: false, error: password.message };
  const passwordHash = password.password
    ? await hashPassword(password.password)
    : null;

  const provisioned = await prisma.$transaction((tx) =>
    provisionTenantAdmin(tx, {
      organizationId: org.id,
      actorId: actor.userId,
      admin,
      passwordHash,
      invitationExpiresAt: invitationExpiry(invitationDays),
    })
  );
  const delivered = await deliverAdminInvitation(provisioned, org.name);
  revalidateTenant(org.id);
  return {
    success: true,
    message:
      admin.method === "invite"
        ? "Invitation created."
        : "Tenant admin created.",
    data: password.generated
      ? { ...delivered, temporaryPassword: password.password! }
      : delivered,
  };
}

export const addTenantAdmin = platformAction("addTenantAdmin", _addTenantAdmin);

const resetSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  password: z.string().max(72).optional(),
});

async function _resetTenantAdminPassword(
  actor: PlatformAdminActor,
  raw: z.input<typeof resetSchema>
): Promise<ActionState<{ temporaryPassword?: string }>> {
  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success)
    return { success: false, error: "Select an administrator." };
  const { organizationId, userId } = parsed.data;
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
      role: "ADMIN",
      organization: { deletedAt: null },
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      passwordHistory: true,
    },
  });
  if (!user)
    return {
      success: false,
      error: "This user is not an administrator of the tenant.",
    };

  const password = await resolveTemporaryPassword(
    parsed.data.password,
    organizationId,
    user
  );
  if (!password.ok) return { success: false, error: password.message };
  const data = await temporaryPasswordUpdate(
    password.password,
    user,
    organizationId,
    true
  );
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data });
    await writePlatformAudit(
      {
        actorId: actor.userId,
        action: "RESET_TENANT_ADMIN_PASSWORD",
        entityType: "User",
        entityId: user.id,
        changes: { email: user.email, mustChangePassword: true },
        metadata: { organizationId },
      },
      tx
    );
  });
  revalidateTenant(organizationId);
  return {
    success: true,
    message:
      "Temporary password set. The administrator must change it at the next sign-in.",
    data: password.generated ? { temporaryPassword: password.password } : {},
  };
}

export const resetTenantAdminPassword = platformAction(
  "resetTenantAdminPassword",
  _resetTenantAdminPassword
);
