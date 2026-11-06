// src/actions/account-security.ts
"use server";

/**
 * Self-service sign-in settings: user name and the per-user two-step
 * verification (emailed code after the password). Any signed-in user may
 * change their own; no organisation permission is involved.
 */
import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "@/lib/auth/auth-audit";
import { getAuthSettings } from "@/lib/auth/auth-settings";
import { requireAuth } from "@/lib/auth/require-auth";
import { assignUsername } from "@/lib/auth/username-service";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";

export interface AccountSecurityInfo {
  username: string | null;
  email: string;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  loginOtpEnabled: boolean;
  /** The organisation requires the code for everyone. */
  loginOtpRequired: boolean;
}

async function _getAccountSecurity(): Promise<AccountSecurityInfo | null> {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      email: true,
      passwordHash: true,
      passwordChangedAt: true,
      loginOtpEnabled: true,
      organizationId: true,
    },
  });
  if (!user) return null;
  const s = await getAuthSettings(user.organizationId, [
    "security.requireLoginOtp",
  ] as const);
  return {
    username: user.username,
    email: user.email,
    hasPassword: Boolean(user.passwordHash),
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
    loginOtpEnabled: user.loginOtpEnabled,
    loginOtpRequired: s["security.requireLoginOtp"],
  };
}
export const getAccountSecurity = withLogging(
  "getAccountSecurity",
  _getAccountSecurity
);

async function _updateOwnUsername(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAuth();
  const result = await assignUsername(
    session.user.id,
    formData.get("username")
  );
  if (!result.ok) {
    return {
      success: false,
      message: result.message,
      errors: { username: [result.message] },
    };
  }
  if (result.changed) {
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.usernameChanged,
      subjectUserId: session.user.id,
      organizationId: session.user.organizationId ?? null,
      metadata: { username: result.username },
    });
    revalidatePath("/settings/profile");
  }
  return { success: true, message: "User name saved" };
}
export const updateOwnUsername = withLogging(
  "updateOwnUsername",
  _updateOwnUsername
);

async function _setOwnTwoStepVerification(
  enabled: boolean
): Promise<ActionState> {
  const session = await requireAuth();
  if (typeof enabled !== "boolean") {
    return { success: false, message: "Invalid value" };
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { loginOtpEnabled: enabled },
  });
  await recordAuthEvent({
    action: AUTH_AUDIT_ACTIONS.twoStepChanged,
    subjectUserId: session.user.id,
    organizationId: session.user.organizationId ?? null,
    metadata: { enabled },
  });
  revalidatePath("/settings/profile");
  return {
    success: true,
    message: enabled
      ? "Two-step verification turned on"
      : "Two-step verification turned off",
  };
}
export const setOwnTwoStepVerification = withLogging(
  "setOwnTwoStepVerification",
  _setOwnTwoStepVerification
);
