// src/actions/auth-credentials.ts
"use server";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { sendVerificationEmail } from "@/lib/services/notification/email-auth";
import { passwordSchema } from "@/lib/validation/password";
import type { ActionState } from "@/types";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  name: z.string().min(1, "Please enter a name").max(100, "Name is too long"),
});

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
}

/**
 * Sign up with email/password
 * 1. Check for a duplicate email
 * 2. Hash the password
 * 3. Create the User (emailVerified = null)
 * 4. Create a verification token and send the email
 */
async function _registerUser(
  input: RegisterUserInput | FormData
): Promise<ActionState> {
  try {
    // Extract data from FormData or a plain object
    const rawData =
      input instanceof FormData
        ? {
            email: input.get("email"),
            password: input.get("password"),
            name: input.get("name"),
          }
        : input;

    // Validate
    const parsed = registerSchema.safeParse(rawData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        fieldErrors.email?.[0] ||
        fieldErrors.password?.[0] ||
        fieldErrors.name?.[0] ||
        "Please check your input";

      return {
        success: false,
        message: firstError,
        errors: fieldErrors as Record<string, string[]>,
      };
    }

    const { email, password, name } = parsed.data;

    // Check for a duplicate email (including the Account table to detect OAuth users)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: {
          select: { provider: true },
        },
      },
    });

    if (existingUser) {
      // Google OAuth user
      const googleAccount = existingUser.accounts.find(
        (acc) => acc.provider === "google"
      );

      if (googleAccount) {
        return {
          success: false,
          message: "This email is already registered with Google",
          error: "EMAIL_EXISTS_OAUTH_GOOGLE",
        };
      }

      // Email/password user (has a passwordHash)
      if (existingUser.passwordHash) {
        return {
          success: false,
          message: "This email is already registered",
          error: "EMAIL_EXISTS_CREDENTIALS",
        };
      }

      // Other OAuth users (Okta, Microsoft, etc. - future extension)
      return {
        success: false,
        message: "This email is already in use",
        error: "EMAIL_EXISTS",
      };
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the User (emailVerified = null, organizationId = null)
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerified: null,
      },
    });

    // Create a verification token (valid for 24 hours)
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send the verification email
    await sendVerificationEmail({
      to: email,
      token,
      userName: name,
    });

    return {
      success: true,
      message:
        "Sign-up complete. Please check your email to verify your account.",
    };
  } catch (error) {
    logger.error({ err: error }, "Sign-up error");
    return {
      success: false,
      message: "An error occurred during sign-up",
    };
  }
}
export const registerUser = withLogging("registerUser", _registerUser);

/**
 * Verify an email verification token
 */
async function _verifyEmail(token: string): Promise<ActionState> {
  try {
    // Look up the token
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return {
        success: false,
        message: "Invalid verification link",
      };
    }

    // Check expiry
    if (new Date() > verificationToken.expires) {
      // Delete the expired token
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });

      return {
        success: false,
        message: "The verification link has expired. Please request a new one.",
      };
    }

    // Update the User's emailVerified
    await prisma.user.update({
      where: { email: verificationToken.email },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    });

    return {
      success: true,
      message: "Your email has been verified. Please sign in.",
    };
  } catch (error) {
    logger.error({ err: error }, "Email verification error");
    return {
      success: false,
      message: "An error occurred while verifying the email",
    };
  }
}
export const verifyEmail = withLogging("verifyEmail", _verifyEmail);

/**
 * Resend the verification email
 */
async function _resendVerificationEmail(email: string): Promise<ActionState> {
  try {
    // Look up the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Do not reveal whether the user exists, for security
      return {
        success: true,
        message: "Email sent. Please check your inbox.",
      };
    }

    // Already verified
    if (user.emailVerified) {
      return {
        success: false,
        message: "This email is already verified",
      };
    }

    // Delete existing tokens
    await prisma.emailVerificationToken.deleteMany({
      where: { email },
    });

    // Create a new token
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expires,
      },
    });

    // Send the email
    await sendVerificationEmail({
      to: email,
      token,
      userName: user.name || undefined,
    });

    return {
      success: true,
      message: "Verification email sent. Please check your inbox.",
    };
  } catch (error) {
    logger.error({ err: error }, "Verification email resend error");
    return {
      success: false,
      message: "An error occurred while sending the email",
    };
  }
}
export const resendVerificationEmail = withLogging(
  "resendVerificationEmail",
  _resendVerificationEmail
);
