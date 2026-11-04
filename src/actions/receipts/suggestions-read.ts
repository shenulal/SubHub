// src/actions/receipts/suggestions-read.ts
"use server";

/** Read side of the receipt review queue. */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import {
  receiptSuggestionFilterSchema,
  type ReceiptSuggestionFilter,
} from "@/lib/validations/receipts";
import type { ActionState } from "@/types";
import type {
  LinkableSubscriptionDTO,
  ReceiptSuggestionDTO,
} from "@/types/receipts";
import type { Prisma, ReceiptSuggestionStatus } from "@prisma/client";
import {
  loadMatchedSubscriptions,
  resolveReceiptScope,
  scopeWhere,
  SUGGESTION_INCLUDE,
  toActionError,
  toNumber,
  toSuggestionDTO,
  validationFailure,
} from "./_shared";

export interface ReceiptSuggestionPage {
  items: ReceiptSuggestionDTO[];
  total: number;
  page: number;
  limit: number;
  /** Tab counters, independent of the active status filter */
  counts: Record<ReceiptSuggestionStatus, number>;
}

const LINKABLE_LIMIT = 50;

function buildWhere(
  base: { organizationId: string; userId?: string },
  filter: ReturnType<typeof receiptSuggestionFilterSchema.parse>
): Prisma.ReceiptSuggestionWhereInput {
  return {
    ...base,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.mailboxId ? { mailboxId: filter.mailboxId } : {}),
    ...(filter.minConfidence !== undefined
      ? { confidence: { gte: filter.minConfidence } }
      : {}),
    ...(filter.search
      ? {
          OR: [
            { vendorName: { contains: filter.search, mode: "insensitive" } },
            { subject: { contains: filter.search, mode: "insensitive" } },
            { senderEmail: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

async function _getReceiptSuggestions(
  input: ReceiptSuggestionFilter = {}
): Promise<ActionState<ReceiptSuggestionPage>> {
  const parsed = receiptSuggestionFilterSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const filter = parsed.data;
  try {
    const scope = await resolveReceiptScope();
    const base = scopeWhere(scope);
    const where = buildWhere(base, filter);

    const [rows, total, grouped] = await Promise.all([
      prisma.receiptSuggestion.findMany({
        where,
        include: SUGGESTION_INCLUDE,
        orderBy: [{ createdAt: "desc" }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      prisma.receiptSuggestion.count({ where }),
      prisma.receiptSuggestion.groupBy({
        by: ["status"],
        where: buildWhere(base, { ...filter, status: undefined }),
        _count: { _all: true },
      }),
    ]);

    const counts: Record<ReceiptSuggestionStatus, number> = {
      NEW: 0,
      ACCEPTED: 0,
      DISMISSED: 0,
      DUPLICATE: 0,
    };
    for (const g of grouped) counts[g.status] = g._count._all;

    const matched = await loadMatchedSubscriptions(
      scope.organizationId,
      rows.map((r) => r.matchedSubscriptionId)
    );
    return {
      success: true,
      data: {
        items: rows.map((row) =>
          toSuggestionDTO(
            row,
            row.matchedSubscriptionId
              ? (matched.get(row.matchedSubscriptionId) ?? null)
              : null
          )
        ),
        total,
        page: filter.page,
        limit: filter.limit,
        counts,
      },
    };
  } catch (error) {
    return toActionError(error, "getReceiptSuggestions");
  }
}

/** Candidate subscriptions for the "Link to existing" dialog. */
async function _getLinkableSubscriptions(
  search = ""
): Promise<ActionState<LinkableSubscriptionDTO[]>> {
  try {
    const scope = await resolveReceiptScope();
    const term = search.trim().slice(0, 120);
    const rows = await prisma.subscription.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(term
          ? { app: { name: { contains: term, mode: "insensitive" } } }
          : {}),
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        billingCycle: true,
        app: { select: { name: true } },
      },
      orderBy: { app: { name: "asc" } },
      take: LINKABLE_LIMIT,
    });
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        appName: r.app.name,
        amount: toNumber(r.amount) ?? 0,
        currency: r.currency,
        billingCycle: r.billingCycle,
      })),
    };
  } catch (error) {
    return toActionError(error, "getLinkableSubscriptions");
  }
}

export const getReceiptSuggestions = withLogging(
  "getReceiptSuggestions",
  _getReceiptSuggestions
);
export const getLinkableSubscriptions = withLogging(
  "getLinkableSubscriptions",
  _getLinkableSubscriptions
);
