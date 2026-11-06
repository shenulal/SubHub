// src/actions/member-credentials.ts
"use server";

/**
 * Administrator controls for a member's sign-in: user name, temporary
 * password (forced change at next sign-in) and unlocking after a lockout.
 * For on-premise sites without email this is how members get a password.
 * Requires `members:manage_credentials`; scoped to the caller's organisation.
 */
import { toActionError } from "@/actions/platform/_shared";
import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "@/lib/auth/auth-audit";
import {
  buildPasswordUpdate,
  getPasswordPolicy,
  validateNewPassword,
} from "@/lib/auth/password-policy";
import { assignUsername } from "@/lib/auth/username-service";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface MemberCredentialInfo {
  username: string | null;
  hasPassword: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lockedUntil: string | null;
  failedLoginAttempts: number;
}

const memberSelect = {
  id: true,
  role: true,
  email: true,
  organizationId: true,
  username: true,
  passwordHash: true,
  passwordHistory: true,
  mustChangePassword: true,
  passwordChangedAt: true,
  lockedUntil: true,
  failedLoginAttempts: true,
} as const;

async function findMember(organizationId: string, userId: string) {
  if (typeof userId !== "string" || !userId) return null;
  return prisma.user.findFirst({
    where: { id: userId, organizationId, role: { not: "SUPER_ADMIN" } },
    select: memberSelect,
  });
}

async function _getMemberCredentials(
  userId: string
): Promise<ActionState<MemberCredentialInfo>> {
  try {
    const { organizationId } = await requirePermission(
      "members:manage_credentials"
    );
    const member = await findMember(organizationId, userId);
    if (!member) return { success: false, error: "Member not found" };
    return {
      success: true,
      data: {
        username: member.username,
        hasPassword: Boolean(member.passwordHash),
        mustChangePassword: member.mustChangePassword,
        passwordChangedAt: member.passwordChangedAt?.toISOString() ?? null,
        lockedUntil:
          member.lockedUntil && member.lockedUntil > new Date()
            ? member.lockedUntil.toISOString()
            : null,
        failedLoginAttempts: member.failedLoginAttempts,
      },
    };
  } catch (error) {
    return toActionError(error, "getMemberCredentials");
  }
}
export const getMemberCredentials = withLogging(
  "getMemberCredentials",
  _getMemberCredentials
);

const credentialsFormSchema = z.object({
  username: z.string().max(64).optional(),
  password: z.string().max(256).optional(),
  mustChangePassword: z.boolean(),
  unlock: z.boolean(),
});

function readBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

/**
 * Save a member's user name and, optionally, a temporary password. Empty
 * password = leave the password unchanged.
 */
async function _setMemberCredentials(
  userId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const actor = await requirePermission("members:manage_credentials");
    const member = await findMember(actor.organizationId, userId);
    if (!member) return { success: false, error: "Member not found" };
    if (member.id === actor.userId) {
      return {
        success: false,
        error: "Change your own sign-in details in your profile",
      };
    }
    const input = credentialsFormSchema.parse({
      username: (formData.get("username") as string | null) ?? undefined,
      password: (formData.get("password") as string | null) || undefined,
      mustChangePassword: readBool(formData, "mustChangePassword"),
      unlock: readBool(formData, "unlock"),
    });

    if (input.username !== undefined) {
      const result = await assignUsername(member.id, input.username);
      if (!result.ok) {
        return {
          success: false,
          error: result.message,
          errors: { username: [result.message] },
        };
      }
      if (result.changed) {
        await recordAuthEvent({
          action: AUTH_AUDIT_ACTIONS.usernameChanged,
          subjectUserId: member.id,
          actorUserId: actor.userId,
          organizationId: actor.organizationId,
          metadata: { username: result.username, byAdmin: true },
        });
      }
    }

    if (input.password) {
      const policy = await getPasswordPolicy(actor.organizationId);
      const problem = await validateNewPassword(input.password, member, policy);
      if (problem) {
        return {
          success: false,
          error: problem,
          errors: { password: [problem] },
        };
      }
      const data = await buildPasswordUpdate(input.password, member, {
        historyCount: policy.historyCount,
        mustChangePassword: input.mustChangePassword,
      });
      await prisma.user.update({ where: { id: member.id }, data });
      await recordAuthEvent({
        action: AUTH_AUDIT_ACTIONS.passwordSetByAdmin,
        subjectUserId: member.id,
        actorUserId: actor.userId,
        organizationId: actor.organizationId,
        metadata: { mustChangePassword: input.mustChangePassword },
      });
    } else if (
      input.unlock &&
      (member.lockedUntil || member.failedLoginAttempts)
    ) {
      await prisma.user.update({
        where: { id: member.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      await recordAuthEvent({
        action: AUTH_AUDIT_ACTIONS.accountUnlocked,
        subjectUserId: member.id,
        actorUserId: actor.userId,
        organizationId: actor.organizationId,
      });
    }

    revalidatePath(`/users/${member.id}`);
    return { success: true, message: "Sign-in details saved" };
  } catch (error) {
    return toActionError(error, "setMemberCredentials");
  }
}
export const setMemberCredentials = withLogging(
  "setMemberCredentials",
  _setMemberCredentials
);
