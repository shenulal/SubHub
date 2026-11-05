// src/lib/validation/password.ts
// Password validation schema (Zod)

import { z } from "zod";

/**
 * Password validation schema
 * - at least 8 characters
 * - at most 72 characters (bcrypt limit)
 * - contains an uppercase letter
 * - contains a lowercase letter
 * - contains a number
 * - contains a special character
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

/**
 * Password validation result type
 */
export interface PasswordValidationResult {
  success: boolean;
  errors?: string[];
}

/**
 * Validates a password and returns the result.
 * @param password password to validate
 * @returns validation result
 */
export function validatePassword(password: string): PasswordValidationResult {
  const result = passwordSchema.safeParse(password);

  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    errors: result.error.issues.map((e) => e.message),
  };
}
