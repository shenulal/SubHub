// src/lib/services/receipts/scanner.persist.ts
/**
 * Persistence side of a mailbox scan: suggestion upserts, price-change events
 * and the owner notification.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/services/notification/center";
import type { ParsedReceipt, RawMessage } from "@/types/receipts";
import { priceChangePercent, type SubscriptionMatch } from "./matcher";

export const RECEIPTS_QUEUE_PATH = "/subscriptions/receipts";
const SNIPPET_MAX = 280;
const ERROR_MAX = 500;

export interface ScanContext {
  connectionId: string;
  organizationId: string;
  userId: string;
}

export interface UpsertOutcome {
  created: boolean;
  updated: boolean;
  duplicate: boolean;
}

export async function upsertSuggestion(
  ctx: ScanContext,
  message: RawMessage,
  parsed: ParsedReceipt,
  match: SubscriptionMatch | null
): Promise<UpsertOutcome> {
  const status = match?.isDuplicate ? "DUPLICATE" : "NEW";
  const fields = {
    vendorName: parsed.vendorName ?? "Unknown vendor",
    senderEmail: parsed.senderEmail,
    subject: message.subject.slice(0, 500) || null,
    amount: parsed.amount,
    currency: parsed.currency,
    billingCycle: parsed.billingCycle,
    chargedAt: parsed.chargedAt,
    nextRenewalAt: parsed.nextRenewalAt,
    confidence: parsed.confidence,
    snippet:
      (message.snippet || message.bodyText).slice(0, SNIPPET_MAX) || null,
    matchedCatalogId: parsed.catalogId,
    matchedSubscriptionId: match?.subscriptionId ?? null,
  };

  const existing = await prisma.receiptSuggestion.findUnique({
    where: {
      mailboxId_messageId: {
        mailboxId: ctx.connectionId,
        messageId: message.id,
      },
    },
    select: { id: true, status: true },
  });

  if (!existing) {
    await prisma.receiptSuggestion.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        mailboxId: ctx.connectionId,
        messageId: message.id,
        status,
        ...fields,
      },
    });
    return { created: true, updated: false, duplicate: status === "DUPLICATE" };
  }

  // Never overwrite a decision the user already made.
  if (existing.status === "ACCEPTED" || existing.status === "DISMISSED") {
    return { created: false, updated: false, duplicate: false };
  }
  await prisma.receiptSuggestion.update({
    where: { id: existing.id },
    data: { status, ...fields },
  });
  return { created: false, updated: true, duplicate: status === "DUPLICATE" };
}

/**
 * Record a price change when the receipt amount drifts from the tracked
 * subscription amount by more than the organisation threshold.
 * Guarded by the unique (subscriptionId, source, sourceRecordId) index.
 */
export async function recordPriceChange(
  ctx: ScanContext,
  message: RawMessage,
  parsed: ParsedReceipt,
  match: SubscriptionMatch | null,
  thresholdPercent: number
): Promise<boolean> {
  if (!match || parsed.amount === null || !parsed.currency) return false;
  if (parsed.currency.toUpperCase() !== match.currency.toUpperCase())
    return false;
  const percent = priceChangePercent(match.amount, parsed.amount);
  if (percent <= thresholdPercent) return false;

  const already = await prisma.priceChangeEvent.findFirst({
    where: {
      subscriptionId: match.subscriptionId,
      source: "EMAIL_RECEIPT",
      sourceRecordId: message.id,
    },
    select: { id: true },
  });
  if (already) return false;

  await prisma.priceChangeEvent.create({
    data: {
      organizationId: ctx.organizationId,
      subscriptionId: match.subscriptionId,
      previousAmount: match.amount,
      newAmount: parsed.amount,
      currency: match.currency,
      changePercent: percent,
      source: "EMAIL_RECEIPT",
      sourceRecordId: message.id,
    },
  });
  return true;
}

export async function notifyOwner(
  ctx: ScanContext,
  created: number,
  scanDay: string
): Promise<void> {
  if (created === 0) return;
  try {
    await notify({
      organizationId: ctx.organizationId,
      userIds: [ctx.userId],
      type: "RECEIPT_SUGGESTION",
      title:
        created === 1
          ? "1 new receipt suggestion found in your mailbox"
          : `${created} new receipt suggestions found in your mailbox`,
      body: "Review them to add subscriptions or dismiss false positives.",
      link: RECEIPTS_QUEUE_PATH,
      dedupeKey: `receipt-scan:${ctx.connectionId}:${scanDay}`,
      metadata: { connectionId: ctx.connectionId, created },
    });
  } catch (error) {
    logger.warn(
      { err: error, connectionId: ctx.connectionId },
      "[receipts] notify failed"
    );
  }
}

export async function markConnectionError(
  connectionId: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.mailboxConnection.update({
    where: { id: connectionId },
    data: { status: "ERROR", errorMessage: message.slice(0, ERROR_MAX) },
  });
}
