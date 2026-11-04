// src/actions/receipts/mailboxes.ts
"use server";

/**
 * Mailbox connection actions: list, disconnect, scan now.
 * Connecting happens through the OAuth routes under /api/integrations/mailbox.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { getProvider } from "@/lib/services/receipts/providers";
import { scanMailbox } from "@/lib/services/receipts/scanner";
import { decryptTokens } from "@/lib/services/receipts/tokens";
import { mailboxIdSchema } from "@/lib/validations/receipts";
import type { ActionState } from "@/types";
import type { MailboxConnectionDTO, ScanMailboxResult } from "@/types/receipts";
import { revalidatePath } from "next/cache";
import {
  RECEIPT_PATHS,
  resolveReceiptScope,
  scopeWhere,
  toActionError,
  toMailboxDTO,
  validationFailure,
  writeAudit,
  type ReceiptScope,
} from "./_shared";

async function findScopedMailbox(scope: ReceiptScope, id: string) {
  return prisma.mailboxConnection.findFirst({
    where: { id, ...scopeWhere(scope) },
  });
}

async function _getMailboxes(): Promise<ActionState<MailboxConnectionDTO[]>> {
  try {
    const scope = await resolveReceiptScope();
    const rows = await prisma.mailboxConnection.findMany({
      where: scopeWhere(scope),
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { suggestions: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const newCounts = rows.length
      ? await prisma.receiptSuggestion.groupBy({
          by: ["mailboxId"],
          where: { mailboxId: { in: rows.map((r) => r.id) }, status: "NEW" },
          _count: { _all: true },
        })
      : [];
    const newByMailbox = new Map(
      newCounts.map((c) => [c.mailboxId, c._count._all])
    );
    return {
      success: true,
      data: rows.map((row) =>
        toMailboxDTO(row, newByMailbox.get(row.id) ?? 0, scope.userId)
      ),
    };
  } catch (error) {
    return toActionError(error, "getMailboxes");
  }
}

async function _disconnectMailbox(id: string): Promise<ActionState> {
  const parsed = mailboxIdSchema.safeParse(id);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const scope = await resolveReceiptScope();
    const mailbox = await findScopedMailbox(scope, parsed.data);
    if (!mailbox) return { success: false, error: "Mailbox not found" };

    try {
      await getProvider(mailbox.provider).revoke(decryptTokens(mailbox));
    } catch (error) {
      logger.warn({ err: error, id }, "[receipts] token revocation failed");
    }

    await prisma.mailboxConnection.delete({ where: { id: mailbox.id } });
    await writeAudit({
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: "DISCONNECT_MAILBOX",
      entityType: "MailboxConnection",
      entityId: mailbox.id,
      changes: { provider: mailbox.provider, email: mailbox.email },
    });
    revalidatePath(RECEIPT_PATHS.mailboxes);
    revalidatePath(RECEIPT_PATHS.queue);
    return { success: true, message: "Mailbox disconnected" };
  } catch (error) {
    return toActionError(error, "disconnectMailbox");
  }
}

async function _scanMailboxNow(
  id: string
): Promise<ActionState<ScanMailboxResult>> {
  const parsed = mailboxIdSchema.safeParse(id);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const scope = await resolveReceiptScope();
    const mailbox = await findScopedMailbox(scope, parsed.data);
    if (!mailbox) return { success: false, error: "Mailbox not found" };

    const result = await scanMailbox(mailbox.id);
    await writeAudit({
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: "SCAN_MAILBOX",
      entityType: "MailboxConnection",
      entityId: mailbox.id,
      changes: {
        fetched: result.fetched,
        created: result.created,
        error: result.error ?? null,
      },
    });
    revalidatePath(RECEIPT_PATHS.mailboxes);
    revalidatePath(RECEIPT_PATHS.queue);
    if (result.error)
      return { success: false, error: result.error, data: result };
    return { success: true, data: result };
  } catch (error) {
    return toActionError(error, "scanMailboxNow");
  }
}

export const getMailboxes = withLogging("getMailboxes", _getMailboxes);
export const disconnectMailbox = withLogging(
  "disconnectMailbox",
  _disconnectMailbox
);
export const scanMailboxNow = withLogging("scanMailboxNow", _scanMailboxNow);
