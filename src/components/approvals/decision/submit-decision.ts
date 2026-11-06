// src/components/approvals/decision/submit-decision.ts
"use client";

/**
 * Sends a decision to the right server action. Single requests use the
 * per-request actions (full capture); several ids use the bulk action.
 */
import { bulkDecideRequests } from "@/actions/approvals/bulk-decisions";
import {
  approveRequest,
  cancelRequest,
  provideInfo,
  rejectRequest,
  requestInfo,
} from "@/actions/approvals/decisions";
import type { ActionState } from "@/types";
import type { DecisionDraft, DecisionKind, DecisionTarget } from "./types";

export interface SubmitOutcome {
  success: boolean;
  error?: string;
  errors?: Record<string, string[]>;
  succeeded: number;
  failed: { id: string; error: string }[];
}

function fromState(res: ActionState<unknown>): SubmitOutcome {
  return {
    success: res.success,
    error: res.error,
    errors: res.errors,
    succeeded: res.success ? 1 : 0,
    failed: [],
  };
}

async function single(
  kind: DecisionKind,
  id: string,
  d: DecisionDraft
): Promise<SubmitOutcome> {
  const comment = d.comment.trim();
  switch (kind) {
    case "approve":
      return fromState(
        await approveRequest(id, {
          comment: comment || null,
          conditions: d.conditions.trim() || null,
          costCenterId: d.costCenterId,
          categoryId: d.categoryId,
          effectiveStartDate: d.effectiveStartDate || null,
        })
      );
    case "reject":
      return fromState(
        await rejectRequest(id, { reasonId: d.reasonId, comment })
      );
    case "requestInfo":
      return fromState(await requestInfo(id, comment));
    case "provideInfo":
      return fromState(await provideInfo(id, comment));
    default:
      return fromState(await cancelRequest(id, comment || null));
  }
}

export async function submitDecision(
  kind: DecisionKind,
  target: DecisionTarget,
  draft: DecisionDraft
): Promise<SubmitOutcome> {
  if (target.ids.length === 1) return single(kind, target.ids[0], draft);
  if (kind !== "approve" && kind !== "reject") {
    return { success: false, succeeded: 0, failed: [] };
  }
  const res = await bulkDecideRequests({
    requestIds: target.ids,
    action: kind,
    comment: draft.comment.trim() || null,
    reasonId: kind === "reject" ? draft.reasonId : null,
  });
  if (!res.success || !res.data) return { ...fromState(res), succeeded: 0 };
  return {
    success: res.data.succeeded.length > 0,
    error: res.data.failed[0]?.error,
    succeeded: res.data.succeeded.length,
    failed: res.data.failed,
  };
}

/** First message per field, for inline errors. */
export function firstErrors(
  errors: Record<string, string[]> | undefined
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors ?? {})
      .filter(([, list]) => list?.length)
      .map(([key, list]) => [key, list[0]])
  );
}
