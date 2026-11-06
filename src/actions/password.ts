// src/actions/password.ts
"use server";

import {
  getDevOtpOverride,
  shouldLogOtpInsteadOfEmail,
} from "@/actions/otp-dev";
import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "@/lib/auth/auth-audit";
import { getAuthSettings } from "@/lib/auth/auth-settings";
import { findAccountByIdentifier } from "@/lib/auth/authorize";
import { verifyPassword } from "@/lib/auth/password";
import {
  buildPasswordUpdate,
  getPasswordPolicy,
  validateNewPassword,
} from "@/lib/auth/password-policy";
import {
  createResetToken,
  findResetToken,
  hasRecentResetToken,
} from "@/lib/auth/password-reset";
import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  passwordResetUrl,
  sendPasswordResetEmail,
} from "@/lib/services/notification/email-auth";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const GENERIC_RESET_RESPONSE: ActionState = {
  success: true,
  message:
    "If an account matches, a password reset link is on its way. Check your inbox.",
};

const requestResetSchema = z.object({
  email: z.string().trim().min(1, "Enter your email or user name").max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(1, "Enter a new password").max(256),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().max(256).optional().default(""),
  newPassword: z.string().min(1, "Enter a new password").max(256),
  confirmPassword: z.string().max(256).optional(),
});

function field(input: FormData | Record<string, unknown>, key: string) {
  const value = input instanceof FormData ? input.get(key) : input[key];
  return typeof value === "string" ? value : undefined;
}

const PASSWORD_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  organizationId: true,
  status: true,
  passwordHash: true,
  passwordHistory: true,
  mustChangePassword: true,
} as const;

/**
 * Request a password reset (email or user name). Same response whether or not
 * the account exists. Locally without RESEND_API_KEY the link is written to
 * the server log instead of emailed.
 */
async function _requestPasswordReset(
  input: { email: string } | FormData
): Promise<ActionState> {
  try {
    const parsed = requestResetSchema.safeParse({
      email: field(input, "email"),
    });
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Enter your email",
      };
    }
    const account = await findAccountByIdentifier(parsed.data.email);
    if (!account || account.status === "TERMINATED") {
      return GENERIC_RESET_RESPONSE;
    }
    const s = await getAuthSettings(account.organizationId, [
      "security.passwordResetExpiryMinutes",
      "security.authEmailCooldownSeconds",
    ] as const);
    if (
      await hasRecentResetToken(
        account.email,
        s["security.authEmailCooldownSeconds"]
      )
    ) {
      return GENERIC_RESET_RESPONSE;
    }
    const expiryMinutes = s["security.passwordResetExpiryMinutes"];
    const { token } = await createResetToken(account.email, expiryMinutes);
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.passwordResetRequested,
      subjectUserId: account.id,
      organizationId: account.organizationId,
    });

    if (getDevOtpOverride() || shouldLogOtpInsteadOfEmail()) {
      logger.warn(
        { email: account.email, resetUrl: passwordResetUrl(token) },
        "[auth] development password-reset link issued without email delivery"
      );
      return GENERIC_RESET_RESPONSE;
    }
    const sent = await sendPasswordResetEmail({
      to: account.email,
      token,
      userName: account.name ?? undefined,
      expiryMinutes,
    });
    if (!sent.success) {
      logger.error(
        { userId: account.id, error: sent.error },
        "[auth] password reset email failed"
      );
    }
    return GENERIC_RESET_RESPONSE;
  } catch (error) {
    logger.error({ err: error }, "Password reset request error");
    return {
      success: false,
      message: "An error occurred while requesting a password reset",
    };
  }
}
export const requestPasswordReset = withLogging(
  "requestPasswordReset",
  _requestPasswordReset
);

/**
 * Reset the password with a single-use token. Applies the organisation's
 * policy and history rule, clears any lockout and a pending forced change.
 */
async function _resetPassword(
  input: { token: string; password: string } | FormData
): Promise<ActionState> {
  try {
    const parsed = resetPasswordSchema.safeParse({
      token: field(input, "token"),
      password: field(input, "password"),
    });
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Please check your input",
      };
    }
    const lookup = await findResetToken(parsed.data.token);
    if (lookup.status === "expired" && lookup.id) {
      await prisma.passwordResetToken.delete({ where: { id: lookup.id } });
    }
    if (lookup.status !== "valid" || !lookup.email) {
      return {
        success: false,
        message:
          lookup.status === "expired"
            ? "The reset link has expired. Please request a new one."
            : "Invalid reset link",
      };
    }
    const account = await prisma.user.findUnique({
      where: { email: lookup.email },
      select: PASSWORD_ACCOUNT_SELECT,
    });
    if (!account || account.status === "TERMINATED") {
      return { success: false, message: "Invalid reset link" };
    }
    const policy = await getPasswordPolicy(account.organizationId);
    const problem = await validateNewPassword(
      parsed.data.password,
      account,
      policy
    );
    if (problem) return { success: false, message: problem };

    const data = await buildPasswordUpdate(parsed.data.password, account, {
      historyCount: policy.historyCount,
    });
    await prisma.$transaction([
      prisma.user.update({ where: { id: account.id }, data }),
      prisma.passwordResetToken.deleteMany({ where: { email: account.email } }),
    ]);
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.passwordReset,
      subjectUserId: account.id,
      organizationId: account.organizationId,
    });
    return {
      success: true,
      message:
        "Your password has been changed. Please sign in with your new password.",
    };
  } catch (error) {
    logger.error({ err: error }, "Password reset error");
    return {
      success: false,
      message: "An error occurred while resetting the password",
    };
  }
}
export const resetPassword = withLogging("resetPassword", _resetPassword);

/**
 * Change the signed-in user's password. Requires the current password when one
 * is set (also for a forced change after an administrator's temporary
 * password). Clears the forced-change flag.
 */
async function _changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAuth();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: field(formData, "currentPassword") ?? "",
    newPassword: field(formData, "newPassword"),
    confirmPassword: field(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Please check your input",
    };
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (confirmPassword !== undefined && confirmPassword !== newPassword) {
    return { success: false, message: "The new passwords do not match" };
  }
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: PASSWORD_ACCOUNT_SELECT,
  });
  if (!account) return { success: false, message: "Account not found" };
  if (account.passwordHash) {
    const ok = await verifyPassword(currentPassword, account.passwordHash);
    if (!ok) {
      return {
        success: false,
        message: "Your current password is incorrect",
        errors: { currentPassword: ["Your current password is incorrect"] },
      };
    }
    if (await verifyPassword(newPassword, account.passwordHash)) {
      return {
        success: false,
        message: "Choose a password different from your current one",
      };
    }
  }
  const policy = await getPasswordPolicy(account.organizationId);
  const problem = await validateNewPassword(newPassword, account, policy);
  if (problem) return { success: false, message: problem };

  const data = await buildPasswordUpdate(newPassword, account, {
    historyCount: policy.historyCount,
  });
  await prisma.user.update({ where: { id: account.id }, data });
  await recordAuthEvent({
    action: AUTH_AUDIT_ACTIONS.passwordChanged,
    subjectUserId: account.id,
    organizationId: account.organizationId,
    metadata: { forced: account.mustChangePassword },
  });
  revalidatePath("/settings/profile");
  return { success: true, message: "Password updated" };
}
export const changePassword = withLogging("changePassword", _changePassword);
