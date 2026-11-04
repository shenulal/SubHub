// src/lib/services/subscription/duplicates.ts
/**
 * Duplicate-subscription detection: normalised name similarity, vendor domain
 * equality and catalog alias matching, scored against
 * `subscriptions.duplicateSimilarityThreshold`.
 */
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings/service";
import type { SubscriptionStatus } from "@prisma/client";

import { nameSimilarity, normalizeDomain, normalizeName } from "./similarity";

export type DuplicateReason = "name" | "domain" | "alias";

export interface SimilarSubscription {
  subscriptionId: string;
  appName: string;
  similarity: number;
  reason: DuplicateReason;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
}

export interface SimilarityInput {
  name: string;
  vendorDomain?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export interface SimilarityOptions {
  threshold?: number;
  excludeId?: string;
}

interface CandidateRow {
  id: string;
  status: SubscriptionStatus;
  amount: { toString(): string } | number;
  currency: string;
  app: {
    name: string;
    customWebsite: string | null;
    catalog: { website: string | null; aliases: string[] } | null;
  };
}

/** Exact-match-level similarity assigned to domain and alias hits. */
const EXACT_MATCH_SCORE = 1;

function scoreCandidate(
  input: SimilarityInput,
  row: CandidateRow
): { similarity: number; reason: DuplicateReason } {
  const inputDomain = normalizeDomain(input.vendorDomain);
  const candidateDomain = normalizeDomain(
    row.app.customWebsite ?? row.app.catalog?.website
  );
  if (inputDomain && candidateDomain && inputDomain === candidateDomain) {
    return { similarity: EXACT_MATCH_SCORE, reason: "domain" };
  }

  const normalizedInput = normalizeName(input.name);
  const aliases = row.app.catalog?.aliases ?? [];
  if (
    normalizedInput &&
    aliases.some((alias) => normalizeName(alias) === normalizedInput)
  ) {
    return { similarity: EXACT_MATCH_SCORE, reason: "alias" };
  }

  return {
    similarity: nameSimilarity(input.name, row.app.name),
    reason: "name",
  };
}

/**
 * Rank existing subscriptions of the organisation by how likely they are the
 * same vendor as `input`. Results are sorted by similarity, descending.
 */
export async function findSimilarSubscriptions(
  organizationId: string,
  input: SimilarityInput,
  options: SimilarityOptions = {}
): Promise<SimilarSubscription[]> {
  if (!input.name?.trim()) return [];

  const threshold =
    options.threshold ??
    (await getSetting(
      organizationId,
      "subscriptions.duplicateSimilarityThreshold"
    ));

  const rows = (await prisma.subscription.findMany({
    where: {
      organizationId,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      app: {
        select: {
          name: true,
          customWebsite: true,
          catalog: { select: { website: true, aliases: true } },
        },
      },
    },
  })) as CandidateRow[];

  return rows
    .map((row) => {
      const { similarity, reason } = scoreCandidate(input, row);
      return {
        subscriptionId: row.id,
        appName: row.app.name,
        similarity: Number(similarity.toFixed(3)),
        reason,
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
      };
    })
    .filter((candidate) => candidate.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}
