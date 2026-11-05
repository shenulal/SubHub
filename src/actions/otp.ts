"use server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { sendOtpEmail } from "@/lib/services/notification/email-auth";
import type { ActionState } from "@/types";
import { getDevOtpOverride, shouldLogOtpInsteadOfEmail } from "./otp-dev";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;

/**
 * Generate a 6-digit numeric OTP code
 */
function generateOtpCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(OTP_LENGTH, "0");
}

/**
 * Send an OTP code by email
 * - Unregistered email: returns USER_NOT_FOUND
 * - During the 60-second cooldown: returns COOLDOWN_ACTIVE
 * - Deletes existing OTPs, then creates a new OTP and sends the email
 */
async function _sendOtp(email: string): Promise<ActionState> {
  let user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    // Check whether the email has been invited
    const pendingInvitation = await prisma.invitation.findFirst({
      where: { email, status: "PENDING" },
    });

    if (!pendingInvitation) {
      return { success: false, error: "USER_NOT_FOUND" };
    }

    // If invited, create a provisional account (not linked to an organization until the invitation is accepted)
    user = await prisma.user.create({
      data: {
        email,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerified: new Date(),
      },
      select: { id: true, email: true, name: true },
    });
  }

  const recentToken = await prisma.otpToken.findFirst({
    where: {
      email,
      createdAt: { gt: new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000) },
    },
  });

  if (recentToken) {
    return { success: false, error: "COOLDOWN_ACTIVE" };
  }

  await prisma.otpToken.deleteMany({ where: { email } });

  const devCode = getDevOtpOverride();
  const code = devCode ?? generateOtpCode();
  const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.otpToken.create({
    data: { email, code, expires },
  });

  // Local / QA environments without an email provider: never block sign-in.
  if (devCode || shouldLogOtpInsteadOfEmail()) {
    logger.warn(
      {
        email,
        otpCode: code,
        delivery: devCode ? "AUTH_DEV_OTP" : "server-log",
      },
      "[auth] development OTP issued without email delivery"
    );
    return { success: true, message: "Verification code sent" };
  }

  const emailResult = await sendOtpEmail({
    to: email,
    code,
    userName: user.name ?? undefined,
  });

  if (!emailResult.success) {
    return { success: false, error: "EMAIL_SEND_FAILED" };
  }

  return { success: true, message: "Verification code sent" };
}

export const sendOtp = withLogging("sendOtp", _sendOtp);

/**
 * Verify an OTP code
 * - No valid token: returns NO_ACTIVE_OTP
 * - Maximum attempts (5) exceeded: returns MAX_ATTEMPTS_EXCEEDED
 * - Code mismatch: returns INVALID_OTP and increments the attempt count
 * - Code match: deletes the token and returns success
 */
async function _verifyOtp(email: string, code: string): Promise<ActionState> {
  const otpToken = await prisma.otpToken.findFirst({
    where: {
      email,
      expires: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpToken) {
    return { success: false, error: "NO_ACTIVE_OTP" };
  }

  if (otpToken.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, error: "MAX_ATTEMPTS_EXCEEDED" };
  }

  if (otpToken.code !== code) {
    await prisma.otpToken.update({
      where: { id: otpToken.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, error: "INVALID_OTP" };
  }

  await prisma.otpToken.delete({ where: { id: otpToken.id } });

  return { success: true };
}

export const verifyOtp = withLogging("verifyOtp", _verifyOtp);
