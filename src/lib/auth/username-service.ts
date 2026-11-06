// src/lib/auth/username-service.ts
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { optionalUsernameSchema } from "./username";

export type UsernameUpdate =
  | { ok: true; username: string | null; changed: boolean }
  | { ok: false; message: string };

const TAKEN = "That user name is already taken";

/**
 * Validate and store a user name for an account (null clears it). Global
 * uniqueness is enforced by the unique index; the check here only gives a
 * friendly message first.
 */
export async function assignUsername(
  userId: string,
  raw: unknown
): Promise<UsernameUpdate> {
  const parsed = optionalUsernameSchema.safeParse(
    typeof raw === "string" ? raw : null
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid user name",
    };
  }
  const username = parsed.data;
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  if (!current) return { ok: false, message: "Account not found" };
  if (current.username === username) {
    return { ok: true, username, changed: false };
  }
  if (username) {
    const owner = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (owner && owner.id !== userId) return { ok: false, message: TAKEN };
  }
  try {
    await prisma.user.update({ where: { id: userId }, data: { username } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, message: TAKEN };
    }
    throw error;
  }
  return { ok: true, username, changed: true };
}
