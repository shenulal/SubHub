// src/actions/super-admin/admin-users.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { writePlatformAudit } from "@/lib/platform-audit";
import { sendInvitationEmail } from "@/lib/services/notification/email";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveConsoleTenant } from "./_tenant";

export interface AdminUserInfo {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Fetch tenant admins (ADMIN role)
 */
async function _listTenantAdmins(
  organizationId?: string
): Promise<ActionState<AdminUserInfo[]>> {
  await requireSuperAdmin();

  const resolved = await resolveConsoleTenant(organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = resolved.tenant;

  const admins = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      role: "ADMIN",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, data: admins as AdminUserInfo[] };
}

export const listTenantAdmins = withLogging(
  "listTenantAdmins",
  _listTenantAdmins
);

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * Invite a tenant admin (invited with the ADMIN role)
 */
async function _inviteTenantAdmin(
  email: string,
  organizationId?: string
): Promise<ActionState> {
  const { userId: actorId } = await requireSuperAdmin();

  const parsed = inviteSchema.safeParse({ email });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const resolved = await resolveConsoleTenant(organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = resolved.tenant;

  // Check whether the user already belongs to the organization
  const existingUser = await prisma.user.findFirst({
    where: { email: parsed.data.email, organizationId: org.id },
  });

  if (existingUser) {
    return {
      success: false,
      message: "This user already belongs to the organization.",
    };
  }

  // Check for a duplicate invitation
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email: parsed.data.email,
      organizationId: org.id,
      status: "PENDING",
    },
  });

  if (existingInvitation) {
    return {
      success: false,
      message: "An invitation has already been sent to this email address.",
    };
  }

  // Create the invitation
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitation = await prisma.invitation.create({
    data: {
      email: parsed.data.email,
      role: "ADMIN",
      organizationId: org.id,
      expiresAt,
    },
  });

  // Send the invitation email
  try {
    await sendInvitationEmail({
      email: parsed.data.email,
      token: invitation.token,
      organizationName: org.name,
      role: "ADMIN",
    });
  } catch (error) {
    // Delete the invitation if the email fails to send
    await prisma.invitation.delete({ where: { id: invitation.id } });
    return { success: false, message: "Failed to send the invitation email." };
  }

  await writePlatformAudit({
    actorId,
    action: "INVITE_TENANT_ADMIN",
    entityType: "Invitation",
    entityId: invitation.id,
    changes: { email: parsed.data.email, role: "ADMIN" },
    metadata: { organizationId: org.id },
  });
  revalidatePath("/super-admin/admins");
  return { success: true, message: "Invitation sent." };
}

export const inviteTenantAdmin = withLogging(
  "inviteTenantAdmin",
  _inviteTenantAdmin
);

/**
 * Change an admin's role (ADMIN ↔ MEMBER)
 */
async function _changeAdminRole(
  userId: string,
  role: "ADMIN" | "MEMBER"
): Promise<ActionState> {
  const { userId: actorId } = await requireSuperAdmin();
  if (role !== "ADMIN" && role !== "MEMBER") {
    return { success: false, message: "Invalid role." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true, email: true },
  });
  if (!target?.organizationId || target.role === "SUPER_ADMIN") {
    return { success: false, message: "User not found." };
  }
  if (target.role === "ADMIN" && role !== "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: {
        organizationId: target.organizationId,
        role: "ADMIN",
        status: "ACTIVE",
        id: { not: userId },
      },
    });
    if (otherAdmins === 0) {
      return {
        success: false,
        message: "The tenant must keep at least one active administrator.",
      };
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });
  await writePlatformAudit({
    actorId,
    action: "CHANGE_TENANT_ADMIN_ROLE",
    entityType: "User",
    entityId: userId,
    changes: { email: target.email, role: { from: target.role, to: role } },
    metadata: { organizationId: target.organizationId },
  });

  revalidatePath("/super-admin/admins");
  return { success: true, message: "Role updated." };
}

export const changeAdminRole = withLogging("changeAdminRole", _changeAdminRole);

export interface TenantInvitationInfo {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Fetch tenant invitation history
 */
async function _listTenantInvitations(
  organizationId?: string
): Promise<ActionState<TenantInvitationInfo[]>> {
  await requireSuperAdmin();

  const resolved = await resolveConsoleTenant(organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = resolved.tenant;

  const invitations = await prisma.invitation.findMany({
    where: { organizationId: org.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, data: invitations as TenantInvitationInfo[] };
}

export const listTenantInvitations = withLogging(
  "listTenantInvitations",
  _listTenantInvitations
);

/**
 * Resend an invitation
 */
async function _resendTenantInvitation(
  invitationId: string
): Promise<ActionState> {
  const { userId: actorId } = await requireSuperAdmin();

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    include: { organization: { select: { name: true } } },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return { success: false, message: "Invalid invitation." };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  const newToken = crypto.randomUUID();

  await prisma.invitation.update({
    where: { id: invitationId },
    data: { expiresAt, token: newToken },
  });

  await sendInvitationEmail({
    email: invitation.email,
    token: newToken,
    organizationName: invitation.organization.name,
    role: invitation.role as "ADMIN",
  });
  await writePlatformAudit({
    actorId,
    action: "RESEND_TENANT_INVITATION",
    entityType: "Invitation",
    entityId: invitation.id,
    changes: { email: invitation.email },
    metadata: { organizationId: invitation.organizationId },
  });

  revalidatePath("/super-admin/admins");
  return { success: true, message: "Invitation resent." };
}

export const resendTenantInvitation = withLogging(
  "resendTenantInvitation",
  _resendTenantInvitation
);
