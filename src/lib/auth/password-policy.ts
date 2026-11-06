// src/lib/auth/password-policy.ts
/**
 * Password policy from the settings registry (Settings > Security): minimum
 * length, required character classes and password history. bcrypt only reads
 * the first 72 bytes, so that is the hard maximum.
 */
import { getSingleTenantOrganization } from "@/lib/deployment/tenancy";
import { getAuthSettings } from "./auth-settings";
import { hashPassword, verifyPassword } from "./password";

export const PASSWORD_MAX_BYTES = 72;

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  historyCount: number;
}

const POLICY_KEYS = [
  "security.passwordMinLength",
  "security.passwordRequireUppercase",
  "security.passwordRequireLowercase",
  "security.passwordRequireNumber",
  "security.passwordRequireSymbol",
  "security.passwordHistoryCount",
] as const;

export async function getPasswordPolicy(
  organizationId: string | null
): Promise<PasswordPolicy> {
  const s = await getAuthSettings(organizationId, POLICY_KEYS);
  return {
    minLength: s["security.passwordMinLength"],
    requireUppercase: s["security.passwordRequireUppercase"],
    requireLowercase: s["security.passwordRequireLowercase"],
    requireNumber: s["security.passwordRequireNumber"],
    requireSymbol: s["security.passwordRequireSymbol"],
    historyCount: s["security.passwordHistoryCount"],
  };
}

/**
 * Policy before sign-in (sign-up): the installation's only organisation in
 * single-tenant mode, otherwise the platform (system) values.
 */
export async function getSignupPasswordPolicy(): Promise<PasswordPolicy> {
  const sole = await getSingleTenantOrganization();
  return getPasswordPolicy(sole?.id ?? null);
}

/** Returns the list of unmet rules (empty = valid). */
export function checkPasswordPolicy(
  password: string,
  policy: PasswordPolicy
): string[] {
  const issues: string[] = [];
  if (password.length < policy.minLength) {
    issues.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    issues.push(`Password must be ${PASSWORD_MAX_BYTES} characters or fewer`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push("Password must contain an uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    issues.push("Password must contain a lowercase letter");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    issues.push("Password must contain a number");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push("Password must contain a symbol");
  }
  return issues;
}

/** Human-readable summary for hints under password fields. */
export function describePasswordPolicy(policy: PasswordPolicy): string {
  const parts = [`at least ${policy.minLength} characters`];
  const classes = [
    policy.requireUppercase && "an uppercase letter",
    policy.requireLowercase && "a lowercase letter",
    policy.requireNumber && "a number",
    policy.requireSymbol && "a symbol",
  ].filter(Boolean) as string[];
  if (classes.length) parts.push(`with ${classes.join(", ")}`);
  return `Use ${parts.join(" ")}.`;
}

export interface PasswordAccount {
  passwordHash: string | null;
  passwordHistory: string[];
}

/** True when the password matches the current or a remembered previous one. */
export async function isRecentlyUsedPassword(
  password: string,
  account: PasswordAccount,
  historyCount: number
): Promise<boolean> {
  if (historyCount <= 0) return false;
  const hashes = [account.passwordHash, ...account.passwordHistory]
    .filter((h): h is string => Boolean(h))
    .slice(0, historyCount);
  for (const hash of hashes) {
    if (await verifyPassword(password, hash)) return true;
  }
  return false;
}

export interface PasswordUpdateData {
  passwordHash: string;
  passwordHistory: string[];
  passwordChangedAt: Date;
  failedLoginAttempts: number;
  lockedUntil: null;
  mustChangePassword: boolean;
}

/** Prisma `data` for a new password, rotating the history. */
export async function buildPasswordUpdate(
  password: string,
  account: PasswordAccount,
  options: { historyCount: number; mustChangePassword?: boolean }
): Promise<PasswordUpdateData> {
  const keep = Math.max(options.historyCount, 0);
  const history = account.passwordHash
    ? [account.passwordHash, ...account.passwordHistory]
    : [...account.passwordHistory];
  return {
    passwordHash: await hashPassword(password),
    passwordHistory: history.slice(0, keep),
    passwordChangedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
    mustChangePassword: options.mustChangePassword ?? false,
  };
}

/**
 * Validate a new password against the policy and history. Returns an error
 * message, or null when the password is acceptable.
 */
export async function validateNewPassword(
  password: string,
  account: PasswordAccount | null,
  policy: PasswordPolicy
): Promise<string | null> {
  const issues = checkPasswordPolicy(password, policy);
  if (issues.length) return issues[0];
  if (
    account &&
    (await isRecentlyUsedPassword(password, account, policy.historyCount))
  ) {
    return `Choose a password you have not used in your last ${policy.historyCount} passwords`;
  }
  return null;
}
