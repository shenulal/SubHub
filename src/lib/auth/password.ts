// src/lib/auth/password.ts
// Password hashing utility (bcryptjs - pure JS implementation)

import * as bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashes a password.
 * @param password Plain-text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies that a password matches a hash.
 * @param password Plain-text password
 * @param hash Stored hash
 * @returns Whether they match
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
