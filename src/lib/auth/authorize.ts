// src/lib/auth/authorize.ts
/**
 * `authorize` implementations for the NextAuth credentials providers:
 *   - `password`    user name or email + password, optional emailed code step;
 *   - `credentials` passwordless email code (only when the setting allows it).
 *
 * Every decision is made here on the server: the second step is required by
 * settings / the user's flag, never by anything the browser sends. Errors are
 * generic so they do not reveal whether an account exists.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { CredentialsSignin } from "@auth/core/errors";
import { z } from "zod";
import { AUTH_AUDIT_ACTIONS, recordAuthEvent } from "./auth-audit";
import { getAuthSettings } from "./auth-settings";
import { isOtpFormat, issueLoginCode, verifyLoginCode } from "./login-otp";
import { hashPassword, verifyPassword } from "./password";
import { SIGN_IN_CODES } from "./sign-in-codes";
import { isEmailIdentifier, normalizeUsername } from "./username";

class SignInFailure extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const signInError = {
  invalid: () => new SignInFailure(SIGN_IN_CODES.invalid),
  otpRequired: () => new SignInFailure(SIGN_IN_CODES.otpRequired),
  otpInvalid: () => new SignInFailure(SIGN_IN_CODES.otpInvalid),
  otpDeliveryFailed: () => new SignInFailure(SIGN_IN_CODES.otpDeliveryFailed),
  locked: () => new SignInFailure(SIGN_IN_CODES.locked),
  ssoRequired: () => new SignInFailure(SIGN_IN_CODES.ssoRequired),
};

export interface AuthorizedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

const passwordCredentialsSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
  otp: z.string().trim().optional(),
  audience: z.enum(["tenant", "platform"]).optional(),
});

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  status: true,
  organizationId: true,
  passwordHash: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  loginOtpEnabled: true,
} as const;

type Account = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  status: string;
  organizationId: string | null;
  passwordHash: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  loginOtpEnabled: boolean;
};

const SIGN_IN_KEYS = [
  "security.maxFailedSignInAttempts",
  "security.lockoutMinutes",
  "security.requireLoginOtp",
  "security.enforceSso",
] as const;

let dummyHash: Promise<string> | null = null;
/** Equalise timing for unknown accounts with a real bcrypt comparison. */
async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("subhub-timing-equaliser");
  await verifyPassword(password, await dummyHash);
}

export async function findAccountByIdentifier(
  identifier: string
): Promise<Account | null> {
  const value = identifier.trim();
  if (isEmailIdentifier(value)) {
    return prisma.user.findFirst({
      where: { email: { equals: value, mode: "insensitive" } },
      select: ACCOUNT_SELECT,
    });
  }
  return prisma.user.findUnique({
    where: { username: normalizeUsername(value) },
    select: ACCOUNT_SELECT,
  });
}

function toAuthorizedUser(account: Account): AuthorizedUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    image: account.image,
  };
}

function isLocked(account: Account, now = new Date()): boolean {
  return Boolean(account.lockedUntil && account.lockedUntil > now);
}

async function registerFailedPassword(
  account: Account,
  settings: { maxAttempts: number; lockoutMinutes: number }
): Promise<never> {
  // A lock that has expired starts a fresh count.
  const previous = account.lockedUntil ? 0 : account.failedLoginAttempts;
  const attempts = previous + 1;
  if (attempts >= settings.maxAttempts) {
    const lockedUntil = new Date(Date.now() + settings.lockoutMinutes * 60_000);
    await prisma.user.update({
      where: { id: account.id },
      data: { failedLoginAttempts: 0, lockedUntil },
    });
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.lockout,
      subjectUserId: account.id,
      organizationId: account.organizationId,
      metadata: { lockedUntil: lockedUntil.toISOString(), attempts },
    });
    throw signInError.locked();
  }
  await prisma.user.update({
    where: { id: account.id },
    data: { failedLoginAttempts: attempts, lockedUntil: null },
  });
  await recordAuthEvent({
    action: AUTH_AUDIT_ACTIONS.signInFailure,
    subjectUserId: account.id,
    organizationId: account.organizationId,
    metadata: { reason: "bad_password", attempts, method: "password" },
  });
  throw signInError.invalid();
}

async function completeSignIn(
  account: Account,
  method: "password" | "password+otp" | "email_code"
): Promise<AuthorizedUser> {
  if (account.failedLoginAttempts > 0 || account.lockedUntil) {
    await prisma.user.update({
      where: { id: account.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
  await recordAuthEvent({
    action: AUTH_AUDIT_ACTIONS.signInSuccess,
    subjectUserId: account.id,
    organizationId: account.organizationId,
    metadata: { method },
  });
  return toAuthorizedUser(account);
}

async function runSecondStep(
  account: Account,
  otp: string | undefined
): Promise<void> {
  if (!otp) {
    const status = await issueLoginCode({
      email: account.email,
      organizationId: account.organizationId,
      userName: account.name,
    });
    if (status === "failed") throw signInError.otpDeliveryFailed();
    if (status === "sent") {
      await recordAuthEvent({
        action: AUTH_AUDIT_ACTIONS.otpSent,
        subjectUserId: account.id,
        organizationId: account.organizationId,
        metadata: { purpose: "two_step" },
      });
    }
    throw signInError.otpRequired();
  }
  const result = await verifyLoginCode({
    email: account.email,
    code: otp,
    organizationId: account.organizationId,
  });
  if (result !== "ok") {
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.signInFailure,
      subjectUserId: account.id,
      organizationId: account.organizationId,
      metadata: { reason: `otp_${result}`, method: "password+otp" },
    });
    throw signInError.otpInvalid();
  }
}

export interface AuthorizeOptions {
  /** True when an SSO provider is configured (enforceSso takes effect). */
  ssoAvailable: boolean;
}

/** `authorize` for the `password` provider. */
export async function authorizePassword(
  raw: Partial<Record<string, unknown>> | undefined,
  options: AuthorizeOptions
): Promise<AuthorizedUser> {
  const parsed = passwordCredentialsSchema.safeParse(raw ?? {});
  if (!parsed.success) throw signInError.invalid();
  const { identifier, password, audience } = parsed.data;
  const otp = parsed.data.otp || undefined;

  const account = await findAccountByIdentifier(identifier);
  if (!account || !account.passwordHash) {
    await burnPasswordCheck(password);
    logger.info(
      { reason: "unknown_account" },
      "[auth] password sign-in failed"
    );
    throw signInError.invalid();
  }

  const s = await getAuthSettings(account.organizationId, SIGN_IN_KEYS);
  if (isLocked(account)) {
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.signInFailure,
      subjectUserId: account.id,
      organizationId: account.organizationId,
      metadata: { reason: "locked", method: "password" },
    });
    throw signInError.locked();
  }

  const passwordOk = await verifyPassword(password, account.passwordHash);
  if (!passwordOk) {
    await registerFailedPassword(account, {
      maxAttempts: s["security.maxFailedSignInAttempts"],
      lockoutMinutes: s["security.lockoutMinutes"],
    });
  }

  // Correct password from here on. Accounts that may not sign in still get
  // the generic error so the response never confirms the password.
  const isSuperAdmin = account.role === "SUPER_ADMIN";
  // Platform operators are disabled with INACTIVE in the Control Panel; tenant
  // users keep INACTIVE as a directory/usage state and may still sign in.
  const platformDisabled = isSuperAdmin && account.status === "INACTIVE";
  if (
    account.status === "TERMINATED" ||
    platformDisabled ||
    (audience === "platform" && !isSuperAdmin)
  ) {
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.signInFailure,
      subjectUserId: account.id,
      organizationId: account.organizationId,
      metadata: {
        reason:
          account.status === "TERMINATED"
            ? "terminated"
            : platformDisabled
              ? "platform_admin_disabled"
              : "not_platform_admin",
      },
    });
    throw signInError.invalid();
  }
  if (s["security.enforceSso"] && options.ssoAvailable && !isSuperAdmin) {
    throw signInError.ssoRequired();
  }

  const needsCode = s["security.requireLoginOtp"] || account.loginOtpEnabled;
  if (needsCode) await runSecondStep(account, otp);
  return completeSignIn(account, needsCode ? "password+otp" : "password");
}

const emailCodeSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim(),
});

/**
 * Passwordless email-code sign-in. Only when the organisation (or, for an
 * account without one, the platform) allows it in Settings > Security.
 */
export async function authorizeEmailCode(
  raw: Partial<Record<string, unknown>> | undefined
): Promise<AuthorizedUser | null> {
  const parsed = emailCodeSchema.safeParse(raw ?? {});
  if (!parsed.success || !isOtpFormat(parsed.data.otp)) return null;
  const account = await findAccountByIdentifier(parsed.data.email);
  if (!account || account.status === "TERMINATED") return null;

  const s = await getAuthSettings(account.organizationId, [
    "security.allowEmailCodeSignIn",
  ] as const);
  if (!s["security.allowEmailCodeSignIn"]) return null;
  if (isLocked(account)) return null;

  const result = await verifyLoginCode({
    email: account.email,
    code: parsed.data.otp,
    organizationId: account.organizationId,
  });
  if (result !== "ok") {
    await recordAuthEvent({
      action: AUTH_AUDIT_ACTIONS.signInFailure,
      subjectUserId: account.id,
      organizationId: account.organizationId,
      metadata: { reason: `otp_${result}`, method: "email_code" },
    });
    return null;
  }
  return completeSignIn(account, "email_code");
}
