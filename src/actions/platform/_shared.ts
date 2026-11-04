// src/actions/platform/_shared.ts
/**
 * Helpers shared by platform server actions: error mapping and audit logging.
 * Not a server action module itself (no "use server").
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isForbiddenError } from "@/lib/rbac/service";
import { SettingValidationError } from "@/lib/settings/service";
import { zodIssuesToErrors } from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export const GENERIC_ERROR = "Something went wrong. Please try again.";

function isNextRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/** Map thrown errors to an ActionState; rethrows Next.js redirects. */
export function toActionError<T = null>(
  error: unknown,
  context: string
): ActionState<T> {
  if (isNextRedirect(error)) throw error;
  if (isForbiddenError(error)) {
    return { success: false, error: error.message };
  }
  if (error instanceof ZodError) {
    return {
      success: false,
      error: "Validation failed",
      errors: zodIssuesToErrors(error),
    };
  }
  if (error instanceof SettingValidationError) {
    return {
      success: false,
      error: error.message,
      errors: { [error.key]: error.issues },
    };
  }
  if (error instanceof ActionError) {
    return { success: false, error: error.message };
  }
  logger.error({ err: error, context }, "[platform] action failed");
  return { success: false, error: GENERIC_ERROR };
}

/** Business-rule violation that is safe to surface to the user verbatim. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export interface AuditInput {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: input.changes,
      metadata: input.metadata,
    },
  });
}

/** Diff two flat records into `{ key: { from, to } }` for audit payloads. */
export function diffRecords(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  redactKeys: ReadonlySet<string> = new Set()
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    out[key] = redactKeys.has(key)
      ? { from: from ? "[redacted]" : null, to: to ? "[redacted]" : null }
      : { from: from ?? null, to: to ?? null };
  }
  return out;
}

export function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}
