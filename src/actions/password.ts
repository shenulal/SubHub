// src/actions/password.ts
"use server";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { sendPasswordResetEmail } from "@/lib/services/notification/email-auth";
import { passwordSchema } from "@/lib/validation/password";
import type { ActionState } from "@/types";
import { z } from "zod";

const requestResetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

/**
 * Request a password reset
 * 1. Look up the user by email
 * 2. Create a reset token (valid for 1 hour)
 * 3. Send the email
 *
 * For security, returns the same response whether or not the user exists
 */
async function _requestPasswordReset(
  input: { email: string } | FormData
): Promise<ActionState> {
  try {
    // Extract data from FormData or a plain object
    const rawData =
      input instanceof FormData ? { email: input.get("email") } : input;

    // Validate
    const parsed = requestResetSchema.safeParse(rawData);
    if (!parsed.success) {
      return {
        success: false,
        message:
          parsed.error.flatten().fieldErrors.email?.[0] ||
          "Please enter a valid email address",
      };
    }

    const { email } = parsed.data;

    // Look up the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, passwordHash: true },
    });

    // No user, or no password set (OAuth-only account)
    // Return the same response for security
    if (!user || !user.passwordHash) {
      return {
        success: true,
        message: "Email sent. Please check your inbox.",
      };
    }

    // Delete existing tokens
    await prisma.passwordResetToken.deleteMany({
      where: { email },
    });

    // Create a new token (valid for 1 hour)
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send the email
    await sendPasswordResetEmail({
      to: email,
      token,
      userName: user.name || undefined,
    });

    return {
      success: true,
      message: "Email sent. Please check your inbox.",
    };
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
 * Reset the password
 * 1. Verify the token
 * 2. Check expiry
 * 3. Hash and update the password
 * 4. Delete the token
 */
async function _resetPassword(
  input: { token: string; password: string } | FormData
): Promise<ActionState> {
  try {
    // Extract data from FormData or a plain object
    const rawData =
      input instanceof FormData
        ? { token: input.get("token"), password: input.get("password") }
        : input;

    // Validate
    const parsed = resetPasswordSchema.safeParse(rawData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        fieldErrors.token?.[0] ||
        fieldErrors.password?.[0] ||
        "Please check your input";

      return {
        success: false,
        message: firstError,
        errors: fieldErrors as Record<string, string[]>,
      };
    }

    const { token, password } = parsed.data;

    // Look up the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return {
        success: false,
        message: "Invalid reset link",
      };
    }

    // Check expiry
    if (new Date() > resetToken.expires) {
      // Delete the expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });

      return {
        success: false,
        message: "The reset link has expired. Please request a new one.",
      };
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Update the password
    await prisma.user.update({
      where: { email: resetToken.email },
      data: { passwordHash },
    });

    // Delete the used token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
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
