// src/actions/auth-credentials.ts
"use server";

import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "@/lib/auth/auth-audit";
import { hashPassword } from "@/lib/auth/password";
import {
  checkPasswordPolicy,
  getSignupPasswordPolicy,
} from "@/lib/auth/password-policy";
import { optionalUsernameSchema } from "@/lib/auth/username";
import { prisma } from "@/lib/db";
import { isSignupOpen } from "@/lib/deployment/tenancy";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { sendVerificationEmail } from "@/lib/services/notification/email-auth";
import type { ActionState } from "@/types";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter a password").max(256),
  name: z
    .string()
    .trim()
    .min(1, "Please enter a name")
    .max(100, "Name is too long"),
  username: optionalUsernameSchema,
});

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  username?: string;
}

function readInput(input: RegisterUserInput | FormData) {
  if (!(input instanceof FormData)) return input;
  return {
    email: input.get("email"),
    password: input.get("password"),
    name: input.get("name"),
    username: input.get("username") ?? undefined,
  };
}

/**
 * Sign up with email/password (optional user name)
 * 1. Validate input and the password policy (Settings > Security)
 * 2. Check for a duplicate email / user name
 * 3. Create the User with a bcrypt hash and send a verification email
 *    (best effort: on-premise installs without email can still sign in)
 */
async function _registerUser(
  input: RegisterUserInput | FormData
): Promise<ActionState> {
  try {
    const parsed = registerSchema.safeParse(readInput(input));
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError =
        fieldErrors.email?.[0] ||
        fieldErrors.password?.[0] ||
        fieldErrors.name?.[0] ||
        fieldErrors.username?.[0] ||
        "Please check your input";
      return {
        success: false,
        message: firstError,
        errors: fieldErrors as Record<string, string[]>,
      };
    }

    const { email, password, name, username } = parsed.data;

    // Server-side gate for the public form: system.allowSelfSignup, or the
    // first-run setup of a single-tenant installation.
    if (!(await isSignupOpen())) {
      return {
        success: false,
        message:
          "Self-service sign-up is disabled. Ask your administrator for an invitation.",
      };
    }

    const issues = checkPasswordPolicy(
      password,
      await getSignupPasswordPolicy()
    );
    if (issues.length) {
      return {
        success: false,
        message: issues[0],
        errors: { password: issues },
      };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });
    if (existingUser) {
      return existingUser.passwordHash
        ? {
            success: false,
            message: "This email is already registered",
            error: "EMAIL_EXISTS_CREDENTIALS",
          }
        : {
            success: false,
            message: "This email is already in use",
            error: "EMAIL_EXISTS",
          };
    }
    if (username) {
      const taken = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (taken) {
        const message = "That user name is already taken";
        return { success: false, message, errors: { username: [message] } };
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        username,
        passwordHash: await hashPassword(password),
        passwordChangedAt: new Date(),
        emailVerified: null,
      },
    });
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.passwordChanged,
      subjectUserId: user.id,
      organizationId: null,
      metadata: { reason: "sign_up" },
    });

    // Create a verification token (valid for 24 hours)
    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    await prisma.emailVerificationToken.create({
      data: { email, token, expires },
    });
    await sendVerificationEmail({ to: email, token, userName: name });

    return {
      success: true,
      message: "Account created. Sign in with your new password.",
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
    const token = randomUUID();
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
