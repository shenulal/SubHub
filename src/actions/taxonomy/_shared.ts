// src/actions/taxonomy/_shared.ts
/** Helpers shared by taxonomy server actions (not a "use server" module). */
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isForbiddenError } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";

export const TAXONOMY_PATHS = {
  settings: "/settings/taxonomy",
  customFields: "/settings/custom-fields",
  subscriptions: "/subscriptions",
} as const;

export const FORBIDDEN_MESSAGE =
  "You do not have permission to perform this action";

/** Maps thrown errors to ActionState; rethrows Next redirects. */
export function toActionError<T = null>(
  error: unknown,
  context: string
): ActionState<T> {
  if (isRedirectError(error)) throw error;
  if (isForbiddenError(error))
    return { success: false, error: FORBIDDEN_MESSAGE };
  logger.error({ err: error }, context);
  return { success: false, error: `${context} failed` };
}

/** Flattens a ZodError into `{ field: [messages] }`. */
export function zodErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}

export function validationFailure<T = null>(error: ZodError): ActionState<T> {
  const first = error.issues[0]?.message ?? "Invalid input";
  return { success: false, error: first, errors: zodErrors(error) };
}

export interface AuditInput {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes?: Prisma.InputJsonValue;
}

export async function writeAudit(
  input: AuditInput,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: input.changes,
    },
  });
}
