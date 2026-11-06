// src/lib/auth/auth-audit.ts
/**
 * Audit trail for authentication events (sign-in, lockout, password changes).
 * Tenant users go to their organisation's audit log; platform administrators
 * (no organisation) go to the platform audit log. Never throws: an audit
 * failure must not block a sign-in.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { Prisma } from "@prisma/client";

export const AUTH_AUDIT_ACTIONS = {
  signInSuccess: "AUTH_SIGN_IN_SUCCEEDED",
  signInFailure: "AUTH_SIGN_IN_FAILED",
  lockout: "AUTH_ACCOUNT_LOCKED",
  otpSent: "AUTH_LOGIN_CODE_SENT",
  passwordChanged: "AUTH_PASSWORD_CHANGED",
  passwordResetRequested: "AUTH_PASSWORD_RESET_REQUESTED",
  passwordReset: "AUTH_PASSWORD_RESET",
  passwordSetByAdmin: "AUTH_PASSWORD_SET_BY_ADMIN",
  usernameChanged: "AUTH_USERNAME_CHANGED",
  twoStepChanged: "AUTH_TWO_STEP_CHANGED",
  accountUnlocked: "AUTH_ACCOUNT_UNLOCKED",
} as const;

export type AuthAuditAction =
  (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];

export interface AuthAuditEntry {
  action: AuthAuditAction;
  /** The account the event is about. */
  subjectUserId: string;
  organizationId: string | null;
  /** Who did it (defaults to the subject). */
  actorUserId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuthEvent(entry: AuthAuditEntry): Promise<void> {
  const actorId = entry.actorUserId ?? entry.subjectUserId;
  try {
    if (entry.organizationId) {
      await prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          userId: actorId,
          action: entry.action,
          entityType: "User",
          entityId: entry.subjectUserId,
          metadata: entry.metadata,
        },
      });
      return;
    }
    await writePlatformAudit({
      actorId,
      action: entry.action,
      entityType: "User",
      entityId: entry.subjectUserId,
      metadata: entry.metadata,
    });
  } catch (err) {
    logger.error({ err, action: entry.action }, "[auth] audit write failed");
  }
}
