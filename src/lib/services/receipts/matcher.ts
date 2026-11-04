// src/lib/services/receipts/matcher.ts
/**
 * Vendor → catalog and vendor → existing-subscription matching used by the
 * scanner. Catalog lookup is done directly against the global catalog table
 * (the `searchCatalog` action needs a session, the cron does not have one).
 */
import { prisma } from "@/lib/db";
import { findSimilarSubscriptions } from "@/lib/services/subscription/duplicates";
import type { ParsedReceipt } from "@/types/receipts";
import type { KnownVendor } from "./parser.vendor";

export async function loadKnownVendors(): Promise<KnownVendor[]> {
  const rows = await prisma.saaSCatalog.findMany({
    where: { isActive: true },
    select: { id: true, name: true, aliases: true, website: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    aliases: r.aliases ?? [],
    website: r.website,
  }));
}

export interface SubscriptionMatch {
  subscriptionId: string;
  appName: string;
  similarity: number;
  amount: number;
  currency: string;
  /** Same vendor, same amount and currency → the receipt is for a subscription we already track */
  isDuplicate: boolean;
}

function amountsEqual(a: number | null, b: number): boolean {
  return a !== null && Math.abs(a - b) < 0.005;
}

/**
 * Best existing subscription for the parsed receipt, or null when nothing in
 * the organisation clears the similarity threshold.
 */
export async function matchExistingSubscription(
  organizationId: string,
  parsed: ParsedReceipt,
  threshold: number
): Promise<SubscriptionMatch | null> {
  if (!parsed.vendorName) return null;
  const similar = await findSimilarSubscriptions(
    organizationId,
    {
      name: parsed.vendorName,
      vendorDomain: parsed.vendorDomain,
      amount: parsed.amount,
      currency: parsed.currency,
    },
    { threshold }
  );
  const best = similar[0];
  if (!best || best.similarity < threshold) return null;
  const sameCurrency =
    !parsed.currency ||
    parsed.currency.toUpperCase() === best.currency.toUpperCase();
  return {
    subscriptionId: best.subscriptionId,
    appName: best.appName,
    similarity: best.similarity,
    amount: best.amount,
    currency: best.currency,
    isDuplicate: sameCurrency && amountsEqual(parsed.amount, best.amount),
  };
}

/** Percentage change between the tracked amount and the receipt amount. */
export function priceChangePercent(previous: number, next: number): number {
  if (previous <= 0) return 0;
  return Math.round((Math.abs(next - previous) / previous) * 10000) / 100;
}
