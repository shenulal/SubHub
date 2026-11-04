// src/actions/receipts/_shared.ts
/** Helpers shared by receipt server actions (not a "use server" module). */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import type { ActionState } from "@/types";
import type {
  MailboxConnectionDTO,
  ReceiptSuggestionDTO,
} from "@/types/receipts";
import type { Prisma } from "@prisma/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";

export const RECEIPT_PATHS = {
  queue: "/subscriptions/receipts",
  mailboxes: "/settings/mailboxes",
  subscriptions: "/subscriptions",
} as const;

export const FORBIDDEN_MESSAGE =
  "You do not have permission to perform this action";

export interface ReceiptScope {
  userId: string;
  organizationId: string;
  /** `mailboxes:manage` → every mailbox / suggestion in the organisation */
  canManageAll: boolean;
  permissions: Set<string>;
}

/**
 * Members with `mailboxes:connect_own` see their own mailboxes and suggestions;
 * `mailboxes:manage` widens that to the whole organisation.
 */
export async function resolveReceiptScope(): Promise<ReceiptScope> {
  const result = await requirePermission(
    ["mailboxes:connect_own", "mailboxes:manage"],
    { mode: "any" }
  );
  return {
    userId: result.userId,
    organizationId: result.organizationId,
    canManageAll: result.permissions.has("mailboxes:manage"),
    permissions: result.permissions,
  };
}

/** Page-level variant: redirects instead of throwing when the member lacks both permissions. */
export async function resolveReceiptScopeOrRedirect(
  redirectTo: string
): Promise<ReceiptScope> {
  try {
    return await resolveReceiptScope();
  } catch (error) {
    if (isForbiddenError(error)) redirect(redirectTo);
    throw error;
  }
}

/** Tenant + ownership filter for mailbox/suggestion queries. */
export function scopeWhere(scope: ReceiptScope): {
  organizationId: string;
  userId?: string;
} {
  return scope.canManageAll
    ? { organizationId: scope.organizationId }
    : { organizationId: scope.organizationId, userId: scope.userId };
}

export function toActionError<T = null>(
  error: unknown,
  context: string
): ActionState<T> {
  if (isRedirectError(error)) throw error;
  if (isForbiddenError(error))
    return { success: false, error: FORBIDDEN_MESSAGE };
  logger.error({ err: error }, `[receipts] ${context}`);
  return { success: false, error: `${context} failed` };
}

export function validationFailure<T = null>(error: ZodError): ActionState<T> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return {
    success: false,
    error: error.issues[0]?.message ?? "Invalid input",
    errors,
  };
}

export async function writeAudit(input: {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
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

export function toNumber(
  value: { toString(): string } | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export const SUGGESTION_INCLUDE = {
  mailbox: { select: { email: true, provider: true } },
  matchedCatalog: {
    select: {
      id: true,
      name: true,
      logoUrl: true,
      category: true,
      website: true,
    },
  },
} as const;

export interface SuggestionRow {
  id: string;
  mailboxId: string;
  messageId: string;
  vendorName: string;
  senderEmail: string | null;
  subject: string | null;
  amount: { toString(): string } | number | null;
  currency: string | null;
  billingCycle: ReceiptSuggestionDTO["billingCycle"];
  chargedAt: Date | null;
  nextRenewalAt: Date | null;
  confidence: number;
  snippet: string | null;
  status: ReceiptSuggestionDTO["status"];
  matchedSubscriptionId: string | null;
  createdAt: Date;
  mailbox: { email: string; provider: ReceiptSuggestionDTO["provider"] };
  matchedCatalog: ReceiptSuggestionDTO["matchedCatalog"];
}

export interface MatchedSubscriptionRow {
  id: string;
  amount: { toString(): string } | number;
  currency: string;
  app: { name: string };
}

export function toSuggestionDTO(
  row: SuggestionRow,
  matched: MatchedSubscriptionRow | null
): ReceiptSuggestionDTO {
  return {
    id: row.id,
    mailboxId: row.mailboxId,
    mailboxEmail: row.mailbox.email,
    provider: row.mailbox.provider,
    messageId: row.messageId,
    vendorName: row.vendorName,
    senderEmail: row.senderEmail,
    subject: row.subject,
    amount: toNumber(row.amount),
    currency: row.currency,
    billingCycle: row.billingCycle,
    chargedAt: iso(row.chargedAt),
    nextRenewalAt: iso(row.nextRenewalAt),
    confidence: row.confidence,
    snippet: row.snippet,
    status: row.status,
    matchedCatalog: row.matchedCatalog,
    matchedSubscription: matched
      ? {
          id: matched.id,
          appName: matched.app.name,
          amount: toNumber(matched.amount) ?? 0,
          currency: matched.currency,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface MailboxRow {
  id: string;
  userId: string;
  provider: MailboxConnectionDTO["provider"];
  email: string;
  status: MailboxConnectionDTO["status"];
  lastScannedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  user: { name: string | null; email: string } | null;
  _count: { suggestions: number };
}

export function toMailboxDTO(
  row: MailboxRow,
  newCount: number,
  currentUserId: string
): MailboxConnectionDTO {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    status: row.status,
    lastScannedAt: iso(row.lastScannedAt),
    errorMessage: row.errorMessage,
    suggestionCount: row._count.suggestions,
    newSuggestionCount: newCount,
    ownerName: row.user?.name ?? null,
    ownerEmail: row.user?.email ?? null,
    isOwn: row.userId === currentUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Resolve matched subscriptions for a page of suggestions in one query. */
export async function loadMatchedSubscriptions(
  organizationId: string,
  ids: Array<string | null>
): Promise<Map<string, MatchedSubscriptionRow>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Map();
  const rows = await prisma.subscription.findMany({
    where: { id: { in: unique }, organizationId },
    select: {
      id: true,
      amount: true,
      currency: true,
      app: { select: { name: true } },
    },
  });
  return new Map(rows.map((r) => [r.id, r]));
}
