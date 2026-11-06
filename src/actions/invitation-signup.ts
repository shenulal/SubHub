// src/actions/invitation-signup.ts
"use server";

/**
 * Accepting an invitation without an account: the invitee sets a password
 * (and optionally a user name) on the invitation page. The unguessable
 * invitation token proves ownership of the invited email address.
 */
import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "@/lib/auth/auth-audit";
import {
  buildPasswordUpdate,
  describePasswordPolicy,
  getPasswordPolicy,
  validateNewPassword,
} from "@/lib/auth/password-policy";
import { optionalUsernameSchema } from "@/lib/auth/username";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export interface InvitationSignupInfo {
  email: string;
  organizationName: string;
  /** The invitee already has a password: sign in to accept instead. */
  hasPassword: boolean;
  passwordHint: string;
  minLength: number;
}

async function findOpenInvitation(token: string) {
  if (typeof token !== "string" || !token || token.length > 200) return null;
  const invitation = await prisma.invitation.findFirst({
    where: { token, status: "PENDING", expiresAt: { gt: new Date() } },
    include: { organization: { select: { name: true } } },
  });
  return invitation;
}

async function _getInvitationSignupInfo(
  token: string
): Promise<InvitationSignupInfo | null> {
  const invitation = await findOpenInvitation(token);
  if (!invitation) return null;
  const [user, policy] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: "insensitive" } },
      select: { passwordHash: true },
    }),
    getPasswordPolicy(invitation.organizationId),
  ]);
  return {
    email: invitation.email,
    organizationName: invitation.organization.name,
    hasPassword: Boolean(user?.passwordHash),
    passwordHint: describePasswordPolicy(policy),
    minLength: policy.minLength,
  };
}
export const getInvitationSignupInfo = withLogging(
  "getInvitationSignupInfo",
  _getInvitationSignupInfo
);

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  username: optionalUsernameSchema,
  password: z.string().min(1, "Please enter a password").max(256),
  confirmPassword: z.string().max(256),
});

async function _acceptInvitationWithPassword(
  token: string,
  formData: FormData
): Promise<ActionState<{ email: string }>> {
  try {
    const invitation = await findOpenInvitation(token);
    if (!invitation) {
      return {
        success: false,
        message: "This invitation is invalid or has expired",
      };
    }
    const parsed = schema.safeParse({
      name: formData.get("name"),
      username: formData.get("username") ?? undefined,
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword") ?? "",
    });
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Please check your input",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { name, username, password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
      return { success: false, message: "The passwords do not match" };
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: invitation.email, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        organizationId: true,
        passwordHash: true,
        passwordHistory: true,
      },
    });
    if (existing?.passwordHash) {
      return {
        success: false,
        message:
          "You already have an account. Sign in to accept the invitation.",
        error: "SIGN_IN_REQUIRED",
      };
    }
    if (
      existing?.organizationId &&
      existing.organizationId !== invitation.organizationId
    ) {
      return {
        success: false,
        message: "You already belong to another organization",
      };
    }
    if (username) {
      const taken = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (taken && taken.id !== existing?.id) {
        const message = "That user name is already taken";
        return { success: false, message, errors: { username: [message] } };
      }
    }

    const policy = await getPasswordPolicy(invitation.organizationId);
    const problem = await validateNewPassword(password, null, policy);
    if (problem) {
      return {
        success: false,
        message: problem,
        errors: { password: [problem] },
      };
    }
    const passwordData = await buildPasswordUpdate(
      password,
      { passwordHash: null, passwordHistory: existing?.passwordHistory ?? [] },
      { historyCount: policy.historyCount }
    );
    const membership = {
      organizationId: invitation.organizationId,
      role: invitation.role,
      teamId: invitation.teamId,
      status: "ACTIVE" as const,
      emailVerified: new Date(),
      name,
      username,
      ...passwordData,
    };

    const user = await prisma.$transaction(async (tx) => {
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", token: randomUUID() },
      });
      return existing
        ? tx.user.update({
            where: { id: existing.id },
            data: membership,
            select: { id: true, email: true },
          })
        : tx.user.create({
            data: { email: invitation.email, ...membership },
            select: { id: true, email: true },
          });
    });
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.passwordChanged,
      subjectUserId: user.id,
      organizationId: invitation.organizationId,
      metadata: { reason: "invitation_accepted" },
    });
    return {
      success: true,
      message: "Welcome aboard",
      data: { email: user.email },
    };
  } catch (error) {
    logger.error({ err: error }, "Invitation sign-up error");
    return { success: false, message: "Could not accept the invitation" };
  }
}
export const acceptInvitationWithPassword = withLogging(
  "acceptInvitationWithPassword",
  _acceptInvitationWithPassword
);
