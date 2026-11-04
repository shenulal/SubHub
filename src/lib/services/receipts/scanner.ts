// src/lib/services/receipts/scanner.ts
/**
 * Mailbox scanner: fetch receipt-like messages → parse → gate on confidence →
 * match → persist suggestions / price changes → notify owner.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSettings } from "@/lib/settings/service";
import type { MailboxTokens, ScanMailboxResult } from "@/types/receipts";
import { loadKnownVendors, matchExistingSubscription } from "./matcher";
import { parseReceipt } from "./parser";
import { getProvider, MailboxProviderError } from "./providers";
import {
  markConnectionError,
  notifyOwner,
  recordPriceChange,
  upsertSuggestion,
  type ScanContext,
} from "./scanner.persist";
import { decryptTokens, encryptTokens, isExpiringSoon } from "./tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const SCAN_SETTING_KEYS = [
  "integrations.mailboxLookbackDays",
  "integrations.receiptMinConfidence",
  "integrations.mailboxMaxMessagesPerScan",
  "subscriptions.priceChangeThresholdPercent",
  "subscriptions.duplicateSimilarityThreshold",
] as const;

function emptyResult(connectionId: string): ScanMailboxResult {
  return {
    connectionId,
    fetched: 0,
    parsed: 0,
    belowThreshold: 0,
    created: 0,
    updated: 0,
    duplicates: 0,
    priceChanges: 0,
  };
}

async function ensureFreshTokens(
  connection: {
    id: string;
    provider: "GMAIL" | "OUTLOOK";
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
  },
  now: number
): Promise<MailboxTokens> {
  const tokens = decryptTokens(connection);
  if (!isExpiringSoon(tokens, now)) return tokens;
  const refreshed = await getProvider(connection.provider).refresh(tokens);
  await prisma.mailboxConnection.update({
    where: { id: connection.id },
    data: encryptTokens(refreshed),
  });
  return refreshed;
}

/**
 * Scan one mailbox connection. Never throws for provider/parse failures —
 * the connection is flagged `ERROR` and the failure is returned in `result.error`.
 */
export async function scanMailbox(
  connectionId: string,
  now: Date = new Date()
): Promise<ScanMailboxResult> {
  const result = emptyResult(connectionId);
  const connection = await prisma.mailboxConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) {
    return { ...result, error: "Mailbox connection not found" };
  }
  if (connection.status === "REVOKED") {
    return { ...result, error: "Mailbox access was revoked" };
  }

  const ctx: ScanContext = {
    connectionId,
    organizationId: connection.organizationId,
    userId: connection.userId,
  };

  try {
    const settings = await getSettings(
      connection.organizationId,
      SCAN_SETTING_KEYS
    );
    const tokens = await ensureFreshTokens(connection, now.getTime());
    const since =
      connection.lastScannedAt ??
      new Date(
        now.getTime() - settings["integrations.mailboxLookbackDays"] * DAY_MS
      );

    const provider = getProvider(connection.provider);
    const { messages, nextCursor } = await provider.listCandidateMessages(
      tokens,
      {
        since,
        cursor: connection.cursor,
        maxResults: settings["integrations.mailboxMaxMessagesPerScan"],
      }
    );
    result.fetched = messages.length;

    const knownVendors = messages.length > 0 ? await loadKnownVendors() : [];
    for (const message of messages) {
      const parsed = parseReceipt(message, { knownVendors });
      result.parsed++;
      if (
        parsed.confidence < settings["integrations.receiptMinConfidence"] ||
        !parsed.vendorName
      ) {
        result.belowThreshold++;
        continue;
      }
      const match = await matchExistingSubscription(
        connection.organizationId,
        parsed,
        settings["subscriptions.duplicateSimilarityThreshold"]
      );
      const outcome = await upsertSuggestion(ctx, message, parsed, match);
      if (outcome.created) result.created++;
      if (outcome.updated) result.updated++;
      if (outcome.duplicate) result.duplicates++;
      if (
        await recordPriceChange(
          ctx,
          message,
          parsed,
          match,
          settings["subscriptions.priceChangeThresholdPercent"]
        )
      ) {
        result.priceChanges++;
      }
    }

    await prisma.mailboxConnection.update({
      where: { id: connectionId },
      data: {
        lastScannedAt: now,
        cursor: nextCursor ?? connection.cursor,
        status: "ACTIVE",
        errorMessage: null,
      },
    });
    await notifyOwner(ctx, result.created, now.toISOString().slice(0, 10));
    logger.info({ ...result }, "[receipts] mailbox scan complete");
    return result;
  } catch (error) {
    logger.error(
      { err: error, connectionId },
      "[receipts] mailbox scan failed"
    );
    const revoked =
      error instanceof MailboxProviderError && error.code === "AUTH";
    if (revoked) {
      await prisma.mailboxConnection.update({
        where: { id: connectionId },
        data: {
          status: "REVOKED",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    } else {
      await markConnectionError(connectionId, error);
    }
    return {
      ...result,
      error: error instanceof Error ? error.message : "Unknown scan error",
    };
  }
}

export interface ScanAllResult {
  scanned: number;
  skipped: number;
  errors: number;
  results: ScanMailboxResult[];
}

/**
 * Scan every ACTIVE / ERROR connection whose last scan is older than the
 * organisation's `integrations.mailboxScanIntervalHours`.
 */
export async function scanAllMailboxes(
  now: Date = new Date()
): Promise<ScanAllResult> {
  const connections = await prisma.mailboxConnection.findMany({
    where: { status: { in: ["ACTIVE", "ERROR"] } },
    select: { id: true, organizationId: true, lastScannedAt: true },
    orderBy: { lastScannedAt: "asc" },
  });

  const summary: ScanAllResult = {
    scanned: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };
  const intervalCache = new Map<string, number>();

  for (const connection of connections) {
    let intervalHours = intervalCache.get(connection.organizationId);
    if (intervalHours === undefined) {
      const settings = await getSettings(connection.organizationId, [
        "integrations.mailboxScanIntervalHours",
      ]);
      intervalHours = settings["integrations.mailboxScanIntervalHours"];
      intervalCache.set(connection.organizationId, intervalHours);
    }
    const due =
      !connection.lastScannedAt ||
      now.getTime() - connection.lastScannedAt.getTime() >=
        intervalHours * HOUR_MS;
    if (!due) {
      summary.skipped++;
      continue;
    }
    const result = await scanMailbox(connection.id, now);
    summary.results.push(result);
    summary.scanned++;
    if (result.error) summary.errors++;
  }
  return summary;
}
