// src/lib/platform/passwords.ts
/**
 * Passwords the Control Panel sets for other people (temporary passwords for
 * tenant admins and platform admins). Rules come from the shared password policy
 * (`@/lib/auth/password-policy`, Settings > Security): the tenant's policy for a
 * tenant admin, the platform (system) policy for a super admin.
 */
import {
  buildPasswordUpdate,
  getPasswordPolicy,
  validateNewPassword,
  type PasswordAccount,
  type PasswordUpdateData,
} from "@/lib/auth/password-policy";
import { randomInt } from "node:crypto";

/** Generated passwords are never shorter than this, whatever the policy says. */
export const MIN_GENERATED_PASSWORD_LENGTH = 14;

const GROUPS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*-_=+",
] as const;

/** Random password with every character class (satisfies any policy). */
export function generateTemporaryPassword(length: number): string {
  const all = GROUPS.join("");
  const chars = GROUPS.map((g) => g[randomInt(g.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export type TemporaryPassword =
  | { ok: true; password: string; generated: boolean }
  | { ok: false; message: string };

/**
 * Validate the typed password against the policy (and the account's history),
 * or generate one when nothing was typed.
 */
export async function resolveTemporaryPassword(
  typed: string | null | undefined,
  organizationId: string | null,
  account: PasswordAccount | null = null
): Promise<TemporaryPassword> {
  const policy = await getPasswordPolicy(organizationId);
  if (!typed?.trim()) {
    const length = Math.max(policy.minLength, MIN_GENERATED_PASSWORD_LENGTH);
    return {
      ok: true,
      password: generateTemporaryPassword(length),
      generated: true,
    };
  }
  const problem = await validateNewPassword(typed, account, policy);
  return problem
    ? { ok: false, message: problem }
    : { ok: true, password: typed, generated: false };
}

/** Prisma `data` for an administrator-set password (history rotated). */
export async function temporaryPasswordUpdate(
  password: string,
  account: PasswordAccount,
  organizationId: string | null,
  mustChangePassword: boolean
): Promise<PasswordUpdateData> {
  const policy = await getPasswordPolicy(organizationId);
  return buildPasswordUpdate(password, account, {
    historyCount: policy.historyCount,
    mustChangePassword,
  });
}
