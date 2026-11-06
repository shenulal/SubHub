// src/lib/auth/password-reset.ts
/**
 * Single-use, expiring password-reset tokens. Only a SHA-256 hash of the token
 * is stored (password_reset_tokens.token); the raw value exists only in the
 * emailed link, so a database read cannot be turned into a reset.
 */
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Replace any earlier tokens for the email and return the new raw token. */
export async function createResetToken(
  email: string,
  expiryMinutes: number
): Promise<{ token: string; expires: Date }> {
  const token = generateResetToken();
  const expires = new Date(Date.now() + expiryMinutes * 60_000);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, token: hashResetToken(token), expires },
    }),
  ]);
  return { token, expires };
}

export type ResetTokenStatus = "valid" | "invalid" | "expired";

export interface ResetTokenLookup {
  status: ResetTokenStatus;
  email?: string;
  id?: string;
}

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,128}$/;

export async function findResetToken(raw: string): Promise<ResetTokenLookup> {
  if (!raw || !TOKEN_SHAPE.test(raw)) return { status: "invalid" };
  const record = await prisma.passwordResetToken.findUnique({
    where: { token: hashResetToken(raw) },
  });
  if (!record) return { status: "invalid" };
  if (record.expires <= new Date()) {
    return { status: "expired", email: record.email, id: record.id };
  }
  return { status: "valid", email: record.email, id: record.id };
}

/** True when a reset email went to this address within the cooldown. */
export async function hasRecentResetToken(
  email: string,
  cooldownSeconds: number
): Promise<boolean> {
  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      email,
      createdAt: { gt: new Date(Date.now() - cooldownSeconds * 1000) },
    },
    select: { id: true },
  });
  return Boolean(recent);
}
