// src/actions/receipts/suggestions-write.ts
"use server";

/** Decisions on receipt suggestions: accept (create subscription), link, dismiss. */
import { createSubscription } from "@/actions/subscriptions";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  acceptReceiptSuggestionSchema,
  dismissReceiptSuggestionsSchema,
  linkReceiptSuggestionSchema,
  type AcceptReceiptSuggestionInput,
  type LinkReceiptSuggestionInput,
} from "@/lib/validations/receipts";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import {
  RECEIPT_PATHS,
  resolveReceiptScope,
  scopeWhere,
  toActionError,
  validationFailure,
  writeAudit,
  type ReceiptScope,
} from "./_shared";

export interface AcceptResult {
  subscriptionId: string;
  appId: string;
  /** true when an existing subscription for the same app was linked instead of created */
  linked: boolean;
}

const OPEN_STATUSES = ["NEW", "DUPLICATE"] as const;

async function findOpenSuggestion(scope: ReceiptScope, id: string) {
  return prisma.receiptSuggestion.findFirst({
    where: { id, ...scopeWhere(scope), status: { in: [...OPEN_STATUSES] } },
    include: { matchedCatalog: { select: { id: true, category: true } } },
  });
}

async function findOrCreateApp(
  organizationId: string,
  name: string,
  catalogId: string | null,
  categoryId: string | null
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.app.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await prisma.app.create({
    data: {
      organizationId,
      name,
      source: "MANUAL",
      status: "ACTIVE",
      catalogId,
      categoryId,
      discoveredAt: new Date(),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

function buildSubscriptionForm(
  appId: string,
  input: ReturnType<typeof acceptReceiptSuggestionSchema.parse>
): FormData {
  const form = new FormData();
  form.set("appId", appId);
  form.set("billingCycle", input.billingCycle);
  form.set("billingType", "FLAT_RATE");
  form.set("amount", input.amount.toFixed(2));
  form.set("currency", input.currency);
  form.set("startDate", input.startDate);
  if (input.renewalDate) form.set("renewalDate", input.renewalDate);
  form.set("autoRenewal", input.billingCycle === "ONE_TIME" ? "false" : "true");
  form.set("renewalAlert30", "true");
  if (input.notes) form.set("notes", input.notes);
  return form;
}

async function markAccepted(
  scope: ReceiptScope,
  suggestionId: string,
  subscriptionId: string,
  action: string,
  changes: Record<string, unknown>
): Promise<void> {
  await prisma.receiptSuggestion.update({
    where: { id: suggestionId },
    data: { status: "ACCEPTED", matchedSubscriptionId: subscriptionId },
  });
  await writeAudit({
    organizationId: scope.organizationId,
    userId: scope.userId,
    action,
    entityType: "ReceiptSuggestion",
    entityId: suggestionId,
    changes: { subscriptionId, ...changes },
  });
  revalidatePath(RECEIPT_PATHS.queue);
  revalidatePath(RECEIPT_PATHS.subscriptions);
}

async function _acceptReceiptSuggestion(
  id: string,
  overrides: AcceptReceiptSuggestionInput
): Promise<ActionState<AcceptResult>> {
  const parsed = acceptReceiptSuggestionSchema.safeParse(overrides);
  if (!parsed.success) return validationFailure(parsed.error);
  const input = parsed.data;
  try {
    const scope = await resolveReceiptScope();
    await requirePermission("subscriptions:create");
    const suggestion = await findOpenSuggestion(scope, id);
    if (!suggestion) return { success: false, error: "Suggestion not found" };

    const app = await findOrCreateApp(
      scope.organizationId,
      input.name,
      suggestion.matchedCatalogId,
      input.categoryId ?? null
    );

    // One subscription per app per organisation: link when one already exists.
    const existing = await prisma.subscription.findFirst({
      where: { appId: app.id, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { lastDetectedAmount: input.amount },
      });
      await markAccepted(
        scope,
        suggestion.id,
        existing.id,
        "ACCEPT_RECEIPT_SUGGESTION",
        {
          appId: app.id,
          linkedExisting: true,
        }
      );
      return {
        success: true,
        message: "Linked to the existing subscription for this app",
        data: { subscriptionId: existing.id, appId: app.id, linked: true },
      };
    }

    const created = await createSubscription(
      { success: false },
      buildSubscriptionForm(app.id, input)
    );
    if (!created.success || !created.data?.id) {
      return {
        success: false,
        error:
          created.error ?? created.message ?? "Could not create subscription",
        errors: created.errors,
      };
    }

    await prisma.subscription.update({
      where: { id: created.data.id },
      data: {
        categoryId: input.categoryId ?? null,
        isTrial: input.isTrial,
        trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : null,
        lastDetectedAmount: input.amount,
      },
    });
    await markAccepted(
      scope,
      suggestion.id,
      created.data.id,
      "ACCEPT_RECEIPT_SUGGESTION",
      {
        appId: app.id,
        appCreated: app.created,
        amount: input.amount,
        currency: input.currency,
        billingCycle: input.billingCycle,
      }
    );
    return {
      success: true,
      message: "Subscription created",
      data: { subscriptionId: created.data.id, appId: app.id, linked: false },
    };
  } catch (error) {
    return toActionError(error, "acceptReceiptSuggestion");
  }
}

async function _linkReceiptSuggestion(
  id: string,
  input: LinkReceiptSuggestionInput
): Promise<ActionState<{ subscriptionId: string }>> {
  const parsed = linkReceiptSuggestionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const scope = await resolveReceiptScope();
    const suggestion = await findOpenSuggestion(scope, id);
    if (!suggestion) return { success: false, error: "Suggestion not found" };
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: parsed.data.subscriptionId,
        organizationId: scope.organizationId,
      },
      select: { id: true },
    });
    if (!subscription)
      return { success: false, error: "Subscription not found" };

    if (parsed.data.updateLastDetectedAmount && suggestion.amount !== null) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { lastDetectedAmount: suggestion.amount },
      });
    }
    await markAccepted(
      scope,
      suggestion.id,
      subscription.id,
      "LINK_RECEIPT_SUGGESTION",
      {
        updatedLastDetectedAmount:
          parsed.data.updateLastDetectedAmount && suggestion.amount !== null,
      }
    );
    return {
      success: true,
      message: "Linked",
      data: { subscriptionId: subscription.id },
    };
  } catch (error) {
    return toActionError(error, "linkReceiptSuggestion");
  }
}

async function _dismissReceiptSuggestions(
  ids: string[]
): Promise<ActionState<{ count: number }>> {
  const parsed = dismissReceiptSuggestionsSchema.safeParse({ ids });
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const scope = await resolveReceiptScope();
    const result = await prisma.receiptSuggestion.updateMany({
      where: {
        id: { in: parsed.data.ids },
        ...scopeWhere(scope),
        status: { in: [...OPEN_STATUSES] },
      },
      data: { status: "DISMISSED" },
    });
    if (result.count > 0) {
      await writeAudit({
        organizationId: scope.organizationId,
        userId: scope.userId,
        action: "DISMISS_RECEIPT_SUGGESTION",
        entityType: "ReceiptSuggestion",
        entityId: parsed.data.ids.length === 1 ? parsed.data.ids[0] : null,
        changes: { ids: parsed.data.ids, count: result.count },
      });
      revalidatePath(RECEIPT_PATHS.queue);
    }
    return { success: true, data: { count: result.count } };
  } catch (error) {
    return toActionError(error, "dismissReceiptSuggestions");
  }
}

export const acceptReceiptSuggestion = withLogging(
  "acceptReceiptSuggestion",
  _acceptReceiptSuggestion
);
export const linkReceiptSuggestion = withLogging(
  "linkReceiptSuggestion",
  _linkReceiptSuggestion
);
export const dismissReceiptSuggestions = withLogging(
  "dismissReceiptSuggestions",
  _dismissReceiptSuggestions
);
