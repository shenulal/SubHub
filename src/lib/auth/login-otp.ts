// src/lib/auth/login-otp.ts
/**
 * Emailed 6-digit sign-in codes (otp_tokens). Used by the optional second
 * step after a correct password and by the setting-gated passwordless
 * "email me a code" sign-in. Validity, attempts and resend cooldown come from
 * Settings > Security. Locally, AUTH_DEV_OTP / the server log replace email.
 */
import {
  getDevOtpOverride,
  shouldLogOtpInsteadOfEmail,
} from "@/actions/otp-dev";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendOtpEmail } from "@/lib/services/notification/email-auth";
import { randomInt } from "node:crypto";
import { getAuthSettings } from "./auth-settings";

const OTP_LENGTH = 6;
const OTP_PATTERN = /^\d{6}$/;

const OTP_KEYS = [
  "security.otpExpiryMinutes",
  "security.otpMaxAttempts",
  "security.authEmailCooldownSeconds",
] as const;

export type IssueLoginCodeStatus = "sent" | "cooldown" | "failed";

export interface IssueLoginCodeInput {
  email: string;
  organizationId: string | null;
  userName?: string | null;
}

export function isOtpFormat(code: unknown): code is string {
  return typeof code === "string" && OTP_PATTERN.test(code);
}

function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

/**
 * Create and deliver a new code. Within the resend cooldown no new code is
 * issued ("cooldown") — the previously sent code stays valid.
 */
export async function issueLoginCode(
  input: IssueLoginCodeInput
): Promise<IssueLoginCodeStatus> {
  const s = await getAuthSettings(input.organizationId, OTP_KEYS);
  const cooldownMs = s["security.authEmailCooldownSeconds"] * 1000;
  const recent = await prisma.otpToken.findFirst({
    where: {
      email: input.email,
      createdAt: { gt: new Date(Date.now() - cooldownMs) },
    },
  });
  if (recent) return "cooldown";

  await prisma.otpToken.deleteMany({ where: { email: input.email } });
  const devCode = getDevOtpOverride();
  const code = devCode ?? generateOtpCode();
  const expires = new Date(
    Date.now() + s["security.otpExpiryMinutes"] * 60_000
  );
  await prisma.otpToken.create({ data: { email: input.email, code, expires } });

  if (devCode || shouldLogOtpInsteadOfEmail()) {
    logger.warn(
      {
        email: input.email,
        otpCode: code,
        delivery: devCode ? "AUTH_DEV_OTP" : "server-log",
      },
      "[auth] development OTP issued without email delivery"
    );
    return "sent";
  }
  const result = await sendOtpEmail({
    to: input.email,
    code,
    userName: input.userName ?? undefined,
    expiryMinutes: s["security.otpExpiryMinutes"],
  });
  return result.success ? "sent" : "failed";
}

export type VerifyLoginCodeResult =
  | "ok"
  | "no_active_code"
  | "max_attempts"
  | "invalid";

/** Check a code; single-use on success, attempt-limited on failure. */
export async function verifyLoginCode(input: {
  email: string;
  code: string;
  organizationId: string | null;
}): Promise<VerifyLoginCodeResult> {
  const token = await prisma.otpToken.findFirst({
    where: { email: input.email, expires: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return "no_active_code";
  const s = await getAuthSettings(input.organizationId, OTP_KEYS);
  if (token.attempts >= s["security.otpMaxAttempts"]) {
    await prisma.otpToken.delete({ where: { id: token.id } });
    return "max_attempts";
  }
  if (!isOtpFormat(input.code) || token.code !== input.code) {
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return "invalid";
  }
  await prisma.otpToken.delete({ where: { id: token.id } });
  return "ok";
}
