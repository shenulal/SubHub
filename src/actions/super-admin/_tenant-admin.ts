// src/actions/super-admin/_tenant-admin.ts
/**
 * Provisioning a Tenant Admin from the Control Panel (create tenant, add admin):
 * either an invitation or an account with a temporary password that must be
 * changed at the next sign-in. Shared helpers, not a server action module.
 */
import { prisma } from "@/lib/db";
import { writePlatformAudit } from "@/lib/platform-audit";
import { resolveTemporaryPassword } from "@/lib/platform/passwords";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import { getBaseUrl } from "@/lib/services/notification/email.utils";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type Db = Prisma.TransactionClient | typeof prisma;

export const tenantAdminSchema = z.object({
  name: z.string().trim().min(1, "Enter the administrator's name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  method: z.enum(["invite", "password"]),
  password: z.string().max(72).optional(),
});

export type TenantAdminInput = z.infer<typeof tenantAdminSchema>;

export interface ProvisionedAdmin {
  email: string;
  method: "invite" | "password";
  userId?: string;
  inviteToken?: string;
  /** Returned once, only when the panel generated the password. */
  temporaryPassword?: string;
  inviteUrl?: string;
  emailSent?: boolean;
}

/** Reason the email cannot become this tenant's admin, or null. */
export async function adminEmailConflict(
  email: string,
  organizationId: string | null,
  method: TenantAdminInput["method"],
  db: Db = prisma
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email },
    select: { organizationId: true, role: true },
  });
  if (user?.role === "SUPER_ADMIN") {
    return "This email belongs to a platform super admin.";
  }
  if (user?.organizationId && user.organizationId === organizationId) {
    return "This user already belongs to the tenant.";
  }
  if (user?.organizationId)
    return "This email already belongs to another tenant.";
  // An existing (unassigned) account keeps its own credentials: invite it instead.
  if (user && method === "password") {
    return "An account with this email already exists. Send an invitation instead.";
  }
  if (!organizationId) return null;
  const pending = await db.invitation.findFirst({
    where: { email, organizationId, status: "PENDING" },
    select: { id: true },
  });
  return pending ? "An invitation is already pending for this email." : null;
}

export type ResolvedPassword =
  | { ok: true; password: string | null; generated: boolean }
  | { ok: false; message: string };

/** Validate (or generate) the temporary password for the "password" method. */
export async function resolveAdminPassword(
  admin: TenantAdminInput,
  organizationId: string | null
): Promise<ResolvedPassword> {
  if (admin.method === "invite")
    return { ok: true, password: null, generated: false };
  return resolveTemporaryPassword(admin.password, organizationId);
}

interface ProvisionArgs {
  organizationId: string;
  actorId: string;
  admin: TenantAdminInput;
  passwordHash: string | null;
  invitationExpiresAt: Date;
}

async function createPasswordAdmin(
  tx: Db,
  args: ProvisionArgs
): Promise<string> {
  const data = {
    name: args.admin.name,
    organizationId: args.organizationId,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    passwordHash: args.passwordHash,
    mustChangePassword: true,
    emailVerified: new Date(),
  };
  const user = await tx.user.create({
    data: { ...data, email: args.admin.email },
    select: { id: true },
  });
  return user.id;
}

async function createAdminInvitation(
  tx: Db,
  args: ProvisionArgs
): Promise<{ id: string; token: string }> {
  const data = {
    role: "ADMIN" as const,
    status: "PENDING" as const,
    token: randomUUID(),
    expiresAt: args.invitationExpiresAt,
    invitedById: args.actorId,
  };
  const invitation = await tx.invitation.upsert({
    where: {
      organizationId_email: {
        organizationId: args.organizationId,
        email: args.admin.email,
      },
    },
    create: {
      ...data,
      organizationId: args.organizationId,
      email: args.admin.email,
    },
    update: data,
    select: { id: true, token: true },
  });
  return invitation;
}

/** Create the admin (or invitation) and audit it — call inside a transaction. */
export async function provisionTenantAdmin(
  tx: Db,
  args: ProvisionArgs
): Promise<ProvisionedAdmin> {
  const { admin, organizationId, actorId } = args;
  if (admin.method === "password") {
    const userId = await createPasswordAdmin(tx, args);
    await writePlatformAudit(
      {
        actorId,
        action: "CREATE_TENANT_ADMIN",
        entityType: "User",
        entityId: userId,
        changes: {
          email: admin.email,
          name: admin.name,
          mustChangePassword: true,
        },
        metadata: { organizationId },
      },
      tx
    );
    return { email: admin.email, method: "password", userId };
  }
  const invitation = await createAdminInvitation(tx, args);
  await writePlatformAudit(
    {
      actorId,
      action: "INVITE_TENANT_ADMIN",
      entityType: "Invitation",
      entityId: invitation.id,
      changes: { email: admin.email, name: admin.name, role: "ADMIN" },
      metadata: { organizationId },
    },
    tx
  );
  return {
    email: admin.email,
    method: "invite",
    inviteToken: invitation.token,
  };
}

/**
 * After commit: email the invitation. When email is not configured or fails,
 * the invitation stays valid and the panel shows the link to share manually.
 */
export async function deliverAdminInvitation(
  provisioned: ProvisionedAdmin,
  organizationName: string
): Promise<ProvisionedAdmin> {
  if (provisioned.method !== "invite" || !provisioned.inviteToken)
    return provisioned;
  const { inviteToken, ...rest } = provisioned;
  const inviteUrl = `${getBaseUrl()}/invite/${inviteToken}`;
  const result = await sendInvitationEmail({
    email: provisioned.email,
    token: inviteToken,
    organizationName,
    inviterName: "The platform administrator",
    role: "ADMIN",
  }).catch(() => ({ success: false as const }));
  return { ...rest, inviteUrl, emailSent: Boolean(result.success) };
}

export function invitationExpiry(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
