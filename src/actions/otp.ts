"use server";

import { getAuthSettings } from "@/lib/auth/auth-settings";
import { issueLoginCode, verifyLoginCode } from "@/lib/auth/login-otp";
import { prisma } from "@/lib/db";
import { getSingleTenantOrganization } from "@/lib/deployment/tenancy";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";

const SENT: ActionState = { success: true, message: "Verification code sent" };

/** Organisation whose settings govern an email before sign-in. */
async function organizationForEmail(
  email: string,
  userOrganizationId: string | null | undefined
): Promise<string | null> {
  if (userOrganizationId) return userOrganizationId;
  const invitation = await prisma.invitation.findFirst({
    where: { email, status: "PENDING" },
    select: { organizationId: true },
  });
  if (invitation?.organizationId) return invitation.organizationId;
  const sole = await getSingleTenantOrganization();
  return sole?.id ?? null;
}

/**
 * Send a passwordless sign-in code by email (only when Settings > Security >
 * "Allow passwordless sign-in with an emailed code" is on).
 * - Unknown email: same response as success, nothing is sent (no enumeration)
 * - Within the resend cooldown: COOLDOWN_ACTIVE
 * - Invited email without an account: a provisional account is created
 */
async function _sendOtp(email: string): Promise<ActionState> {
  const normalized = email.trim();
  let user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
    select: { id: true, email: true, name: true, organizationId: true },
  });
  const organizationId = await organizationForEmail(
    user?.email ?? normalized,
    user?.organizationId
  );
  const s = await getAuthSettings(organizationId, [
    "security.allowEmailCodeSignIn",
  ] as const);
  if (!s["security.allowEmailCodeSignIn"]) {
    return { success: false, error: "EMAIL_CODE_DISABLED" };
  }

  if (!user) {
    const pendingInvitation = await prisma.invitation.findFirst({
      where: { email: normalized, status: "PENDING" },
    });
    if (!pendingInvitation) return SENT;
    // Provisional account, linked to the organisation when the invitation is accepted
    user = await prisma.user.create({
      data: {
        email: normalized,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerified: new Date(),
      },
      select: { id: true, email: true, name: true, organizationId: true },
    });
  }

  const status = await issueLoginCode({
    email: user.email,
    organizationId,
    userName: user.name,
  });
  if (status === "cooldown")
    return { success: false, error: "COOLDOWN_ACTIVE" };
  if (status === "failed")
    return { success: false, error: "EMAIL_SEND_FAILED" };
  return SENT;
}

export const sendOtp = withLogging("sendOtp", _sendOtp);

/**
 * Verify an OTP code
 * - No valid token: NO_ACTIVE_OTP
 * - Maximum attempts exceeded: MAX_ATTEMPTS_EXCEEDED
 * - Code mismatch: INVALID_OTP (attempt count incremented)
 * - Code match: token deleted, success
 */
async function _verifyOtp(email: string, code: string): Promise<ActionState> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { organizationId: true },
  });
  const result = await verifyLoginCode({
    email,
    code,
    organizationId: user?.organizationId ?? null,
  });
  if (result === "ok") return { success: true };
  const errors = {
    no_active_code: "NO_ACTIVE_OTP",
    max_attempts: "MAX_ATTEMPTS_EXCEEDED",
    invalid: "INVALID_OTP",
  } as const;
  return { success: false, error: errors[result] };
}

export const verifyOtp = withLogging("verifyOtp", _verifyOtp);
