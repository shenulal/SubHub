// src/actions/approvals/decisions.ts
"use server";

/**
 * Feature 2.4 — approve / reject / request info / provide info / cancel / comment.
 * Permission gate here, approver-membership check inside the service.
 */
import { withLogging } from "@/lib/logging";
import {
  requirePermission,
  type RequirePermissionResult,
} from "@/lib/rbac/service";
import * as decision from "@/lib/services/approval/decision";
import { parseDateOnly } from "@/lib/services/approval/decision-capture";
import * as requestActions from "@/lib/services/approval/request-actions";
import type { Actor } from "@/lib/services/approval/shared";
import { getSetting } from "@/lib/settings/service";
import {
  buildApproveDecisionSchema,
  buildRejectDecisionSchema,
  type ApproveDecisionInput,
  type RejectDecisionInput,
} from "@/lib/validations/approval-decisions";
import {
  decisionCommentSchema,
  requiredCommentSchema,
} from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type { ApprovalRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { runAction } from "./shared";

export interface DecisionActionResult {
  id: string;
  status: ApprovalRequestStatus;
  subscriptionId?: string | null;
}

function actorOf(ctx: RequirePermissionResult): Actor {
  return { userId: ctx.userId, role: ctx.role, permissions: ctx.permissions };
}

function revalidate(id: string) {
  revalidatePath("/approvals");
  revalidatePath(`/approvals/${id}`);
  revalidatePath("/dashboard");
}

const INVALID = (errors: Record<string, string[]>): ActionState<never> => ({
  success: false,
  error: "Please check your input",
  errors,
});

function approvePayload(
  requestId: string,
  input: string | null | undefined | ApproveDecisionInput
) {
  if (input === null || input === undefined || typeof input === "string") {
    return { requestId, comment: input ?? null };
  }
  return { ...input, requestId };
}

/**
 * Approve. `input` is the decision capture (comment, conditions, cost centre /
 * category assignment, effective start date); a string is the legacy comment.
 */
async function _approveRequest(
  requestId: string,
  input?: string | null | ApproveDecisionInput
): Promise<ActionState<DecisionActionResult>> {
  return runAction("approveRequest", async () => {
    const ctx = await requirePermission("approvals:decide");
    const requireComment = await getSetting(
      ctx.organizationId,
      "approvals.requireApproveComment"
    );
    const parsed = buildApproveDecisionSchema({ requireComment }).safeParse(
      approvePayload(requestId, input)
    );
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const { effectiveStartDate, ...capture } = parsed.data;
    const result = await decision.approveRequest(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      { ...capture, effectiveStartDate: parseDateOnly(effectiveStartDate) }
    );
    revalidate(requestId);
    if (result.subscriptionId) revalidatePath("/subscriptions");
    return { success: true, data: result };
  });
}
export const approveRequest = withLogging("approveRequest", _approveRequest);

/**
 * Reject. `input` = `{ reasonId, comment }` (reason from the "Rejection
 * reasons" master, both required); a string is the legacy comment-only call.
 */
async function _rejectRequest(
  requestId: string,
  input: string | RejectDecisionInput
): Promise<ActionState<DecisionActionResult>> {
  return runAction("rejectRequest", async () => {
    const ctx = await requirePermission("approvals:decide");
    const legacy = typeof input === "string";
    const parsed = buildRejectDecisionSchema({ legacy }).safeParse(
      legacy ? { requestId, comment: input } : { ...input, requestId }
    );
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const result = await decision.rejectRequest(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      { reasonId: parsed.data.reasonId ?? null, comment: parsed.data.comment }
    );
    revalidate(requestId);
    return { success: true, data: result };
  });
}
export const rejectRequest = withLogging("rejectRequest", _rejectRequest);

async function _requestInfo(
  requestId: string,
  comment: string
): Promise<ActionState<DecisionActionResult>> {
  return runAction("requestInfo", async () => {
    const ctx = await requirePermission("approvals:decide");
    const parsed = requiredCommentSchema.safeParse({ requestId, comment });
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const result = await requestActions.requestInfo(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      parsed.data.comment
    );
    revalidate(requestId);
    return { success: true, data: result };
  });
}
export const requestInfo = withLogging("requestInfo", _requestInfo);

async function _provideInfo(
  requestId: string,
  comment: string
): Promise<ActionState<DecisionActionResult>> {
  return runAction("provideInfo", async () => {
    const ctx = await requirePermission("approvals:read");
    const parsed = requiredCommentSchema.safeParse({ requestId, comment });
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const result = await requestActions.provideInfo(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      parsed.data.comment
    );
    revalidate(requestId);
    return { success: true, data: result };
  });
}
export const provideInfo = withLogging("provideInfo", _provideInfo);

async function _cancelRequest(
  requestId: string,
  comment?: string | null
): Promise<ActionState<DecisionActionResult>> {
  return runAction("cancelRequest", async () => {
    const ctx = await requirePermission("approvals:read");
    const parsed = decisionCommentSchema.safeParse({ requestId, comment });
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const result = await requestActions.cancelRequest(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      parsed.data.comment
    );
    revalidate(requestId);
    return { success: true, data: result };
  });
}
export const cancelRequest = withLogging("cancelRequest", _cancelRequest);

async function _addComment(
  requestId: string,
  body: string
): Promise<ActionState<DecisionActionResult>> {
  return runAction("addComment", async () => {
    const ctx = await requirePermission("approvals:read");
    const parsed = requiredCommentSchema.safeParse({
      requestId,
      comment: body,
    });
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const result = await requestActions.addComment(
      ctx.organizationId,
      actorOf(ctx),
      parsed.data.requestId,
      parsed.data.comment
    );
    revalidate(requestId);
    return { success: true, data: result };
  });
}
export const addComment = withLogging("addComment", _addComment);
