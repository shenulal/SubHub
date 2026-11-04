// src/lib/services/subscription/price-change-scan.ts
/**
 * Price-change detection: compare the latest linked payment (PaymentRecord with
 * the same currency, or CardTransaction when the subscription is billed in the
 * organisation base currency — card feeds carry no currency column) against the
 * expected amount (`lastDetectedAmount` ?? `amount`). Deviations at or above
 * `subscriptions.priceChangeThresholdPercent` create a PriceChangeEvent
 * (unique per source record), update `lastDetectedAmount`, notify and audit.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/lib/services/notification/center";
import { getSettings } from "@/lib/settings/service";
import type { PriceChangeSource } from "@prisma/client";

import {
  emptyScanResult,
  listOrganizationIds,
  resolveAlertRecipients,
  type ScanResult,
} from "./alert-support";

export interface ObservedPayment {
  source: PriceChangeSource;
  recordId: string;
  amount: number;
  currency: string;
  observedAt: Date;
}

/** Percentage change rounded to 2 dp; null when the baseline is zero. */
export function percentChange(previous: number, next: number): number | null {
  if (previous === 0) return null;
  return Number((((next - previous) / previous) * 100).toFixed(2));
}

export function exceedsThreshold(
  previous: number,
  next: number,
  thresholdPercent: number
): boolean {
  const change = percentChange(previous, next);
  return change !== null && Math.abs(change) >= thresholdPercent;
}

function cardDate(useDt: string, useTm: string | null): Date {
  // useDt is YYYYMMDD (bank feed); fall back to Date parsing for ISO strings.
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(useDt);
  if (!match) return new Date(useDt);
  const time = useTm && /^\d{6}$/.test(useTm) ? useTm : "000000";
  return new Date(
    `${match[1]}-${match[2]}-${match[3]}T${time.slice(0, 2)}:${time.slice(2, 4)}:${time.slice(4, 6)}Z`
  );
}

/** Most recent linked payment comparable in currency, or null. */
export async function latestLinkedPayment(
  subscription: { id: string; currency: string },
  baseCurrency: string
): Promise<ObservedPayment | null> {
  const [record, card] = await Promise.all([
    prisma.paymentRecord.findFirst({
      where: {
        linkedSubscriptionId: subscription.id,
        currency: subscription.currency,
      },
      orderBy: { transactionDate: "desc" },
      select: { id: true, amount: true, currency: true, transactionDate: true },
    }),
    subscription.currency === baseCurrency
      ? prisma.cardTransaction.findFirst({
          where: {
            linkedSubscriptionId: subscription.id,
            transactionType: "APPROVAL",
          },
          orderBy: [{ useDt: "desc" }, { useTm: "desc" }],
          select: { id: true, useAmt: true, useDt: true, useTm: true },
        })
      : Promise.resolve(null),
  ]);

  const candidates: ObservedPayment[] = [];
  if (record) {
    candidates.push({
      source: "PAYMENT_RECORD",
      recordId: record.id,
      amount: Number(record.amount),
      currency: record.currency,
      observedAt: record.transactionDate,
    });
  }
  if (card) {
    candidates.push({
      source: "CARD_TRANSACTION",
      recordId: card.id,
      amount: Number(card.useAmt),
      currency: baseCurrency,
      observedAt: cardDate(card.useDt, card.useTm),
    });
  }
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => b.observedAt.getTime() - a.observedAt.getTime()
  )[0];
}

async function processSubscription(
  organizationId: string,
  sub: {
    id: string;
    amount: unknown;
    lastDetectedAmount: unknown;
    currency: string;
    ownerId: string | null;
    teamId: string | null;
    app: { name: string };
  },
  thresholdPercent: number,
  baseCurrency: string,
  result: ScanResult
): Promise<void> {
  const observed = await latestLinkedPayment(sub, baseCurrency);
  if (!observed) return;
  const expected = Number(sub.lastDetectedAmount ?? sub.amount);
  if (!exceedsThreshold(expected, observed.amount, thresholdPercent)) return;
  result.matched++;

  const existing = await prisma.priceChangeEvent.findUnique({
    where: {
      subscriptionId_source_sourceRecordId: {
        subscriptionId: sub.id,
        source: observed.source,
        sourceRecordId: observed.recordId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    result.skipped++;
    return;
  }

  const change = percentChange(expected, observed.amount) ?? 0;
  const event = await prisma.priceChangeEvent.create({
    data: {
      organizationId,
      subscriptionId: sub.id,
      previousAmount: expected,
      newAmount: observed.amount,
      currency: observed.currency,
      changePercent: change,
      source: observed.source,
      sourceRecordId: observed.recordId,
    },
    select: { id: true },
  });
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { lastDetectedAmount: observed.amount },
  });

  const recipients = await resolveAlertRecipients(organizationId, sub);
  const direction = change > 0 ? "increased" : "decreased";
  await notify({
    organizationId,
    userIds: recipients,
    type: "PRICE_CHANGE",
    title: `${sub.app.name} price ${direction} ${Math.abs(change)}%`,
    body: `Expected ${expected} ${sub.currency}, charged ${observed.amount} ${observed.currency}.`,
    link: `/subscriptions/${sub.id}`,
    dedupeKey: `price:${event.id}`,
    metadata: { subscriptionId: sub.id, priceChangeEventId: event.id },
  });
  await prisma.auditLog.create({
    data: {
      organizationId,
      action: "DETECT_PRICE_CHANGE",
      entityType: "price_change",
      entityId: sub.id,
      changes: { amount: { from: expected, to: observed.amount } },
      metadata: {
        priceChangeEventId: event.id,
        source: observed.source,
        changePercent: change,
      },
    },
  });
  result.notified++;
}

export async function processPriceChangeScan(): Promise<ScanResult> {
  const result = emptyScanResult();
  const organizationIds = await listOrganizationIds();
  for (const organizationId of organizationIds) {
    result.processedOrganizations++;
    try {
      const settings = await getSettings(organizationId, [
        "subscriptions.priceChangeThresholdPercent",
        "finance.baseCurrency",
      ]);
      const subscriptions = await prisma.subscription.findMany({
        where: { organizationId, status: { in: ["ACTIVE", "PAUSED"] } },
        select: {
          id: true,
          amount: true,
          lastDetectedAmount: true,
          currency: true,
          ownerId: true,
          teamId: true,
          app: { select: { name: true } },
        },
      });
      for (const sub of subscriptions) {
        await processSubscription(
          organizationId,
          sub,
          settings["subscriptions.priceChangeThresholdPercent"],
          settings["finance.baseCurrency"],
          result
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      logger.error({ err: error, organizationId }, "price-change scan failed");
      result.errors.push(`${organizationId}: ${message}`);
    }
  }
  return result;
}
