// src/lib/auth/username.ts
/**
 * User names are optional, globally unique and case-insensitive (always stored
 * lower-case). They never contain "@", so an identifier with "@" is an email.
 */
import { z } from "zod";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;

/** Trim + lower-case. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(
        USERNAME_MIN_LENGTH,
        `User name must be at least ${USERNAME_MIN_LENGTH} characters`
      )
      .max(
        USERNAME_MAX_LENGTH,
        `User name must be ${USERNAME_MAX_LENGTH} characters or fewer`
      )
      .regex(
        USERNAME_PATTERN,
        "Use lower-case letters, numbers, dots, hyphens or underscores, starting and ending with a letter or number"
      )
      .refine((v) => !/[._-]{2}/.test(v), {
        message: "User name cannot contain two separators in a row",
      })
  );

/** Optional user name field: empty string / null clears it. */
export const optionalUsernameSchema = z
  .union([z.literal(""), z.null(), usernameSchema])
  .optional()
  .transform((v) => (v ? v : null));

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes("@");
}
