// src/lib/services/approval/decision.ts
/**
 * Feature 2.4 — approve / reject. Approving advances to the next WAITING step
 * or, on the final step, marks the request APPROVED (and creates the
 * subscription when configured). Rejection ends the request immediately.
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import type { ApprovalRequestStatus } from "@prisma/client";
import { recordApprovalEvent } from "./audit";
import { addDays, getCycleMonths } from "./cycle";
import {
  approveEventMetadata,
  approveRequestColumns,
  resolveApproveCapture,
  resolveRejectCapture,
  toApproveCapture,
  toDateOnly,
  toRejectCapture,
  type ApproveCapture,
  type RejectCapture,
} from "./decision-capture";
import {
  notifyApprovalRequested,
  notifyRequesterDecided,
} from "./notifications";
import {
  ApprovalError,
  canDecide,
  currentStepOf,
  loadRequest,
  nextWaitingStep,
  readMetadata,
  reminderDaysFor,
  toJson,
  toRef,
  type Actor,
  type Db,
  type LoadedRequest,
} from "./shared";
import { createSubscriptionFromRequest } from "./subscription-creator";

export interface DecisionResult {
  id: string;
  status: ApprovalRequestStatus;
  currentStep: number;
  subscriptionId?: string | null;
}

function assertDecidable(request: LoadedRequest, actor: Actor) {
  if (request.status !== "PENDING") {
    throw new ApprovalError("NOT_PENDING", "This request is no longer pending");
  }
  const step = currentStepOf(request);
  if (!step || step.status !== "PENDING") {
    throw new ApprovalError("INVALID_STATE", "No step is awaiting a decision");
  }
  if (!canDecide(actor, request, step)) {
    throw new ApprovalError(
      "NOT_APPROVER",
      "You are not an approver for the current step"
    );
  }
  return step;
}

async function finalise(
  tx: Db,
  request: LoadedRequest,
  actor: Actor,
  now: Date,
  columns: ReturnType<typeof approveRequestColumns>
): Promise<string | null> {
  const settings = await getSettings(request.organizationId, [
    "approvals.autoCreateSubscription",
    "subscriptions.defaultReminderLeadDays",
  ] as const);
  await tx.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: "APPROVED",
      decidedAt: now,
      ...columns,
      metadata: toJson({ ...readMetadata(request), candidateIds: [] }),
    },
  });
  if (!settings["approvals.autoCreateSubscription"]) return null;
  const cycleMonths = await getCycleMonths(request.organizationId, tx);
  return createSubscriptionFromRequest(
    tx,
    {
      id: request.id,
      organizationId: request.organizationId,
      requesterId: request.requesterId,
      serviceName: request.serviceName,
      catalogId: request.catalogId,
      categoryId: columns.categoryId ?? request.categoryId,
      costCenterId: columns.costCenterId ?? request.costCenterId,
      amount: Number(request.amount),
      currency: request.currency,
      billingCycle: request.billingCycle,
      seats: request.seats,
      startDate: columns.effectiveStartDate ?? request.effectiveStartDate,
    },
    {
      cycleMonths,
      reminderLeadDays: settings["subscriptions.defaultReminderLeadDays"],
      actorId: actor.userId,
      now,
    }
  );
}

/** What the requester is told on final approval (all steps' conditions). */
function decidedDetails(
  request: LoadedRequest,
  columns: ReturnType<typeof approveRequestColumns>
) {
  const start = columns.effectiveStartDate ?? request.effectiveStartDate;
  return {
    conditions: columns.decisionConditions,
    effectiveStartDate: start ? toDateOnly(start) : null,
  };
}

/**
 * `input` is the decision capture (comment, conditions, cost centre / category
 * assignment, effective start date); a plain string is the legacy comment.
 */
export async function approveRequest(
  organizationId: string,
  actor: Actor,
  requestId: string,
  input?: string | null | Partial<ApproveCapture>,
  now: Date = new Date(),
  db: Db = prisma
): Promise<DecisionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  const step = assertDecidable(request, actor);
  const next = nextWaitingStep(request);
  const reminderDays = await reminderDaysFor(organizationId, request.policy);
  const meta = readMetadata(request);
  const resolved = await resolveApproveCapture(
    db,
    request,
    toApproveCapture(input)
  );
  const comment = resolved.comment;
  const columns = approveRequestColumns(request, resolved, step.label);

  const run = async (tx: Db): Promise<DecisionResult> => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: {
        status: "APPROVED",
        approverId: actor.userId,
        comment: comment ?? null,
        decidedAt: now,
      },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "APPROVED",
      comment,
      metadata: {
        stepOrder: step.stepOrder,
        stepLabel: step.label,
        final: !next,
        ...approveEventMetadata(resolved),
      },
    });
    if (next) {
      const candidates = meta.stepCandidates?.[String(next.stepOrder)] ?? [
        next.approverId,
      ];
      await tx.approvalStep.update({
        where: { id: next.id },
        data: { status: "PENDING", dueAt: addDays(now, reminderDays) },
      });
      await tx.approvalRequest.update({
        where: { id: requestId },
        data: {
          currentStep: next.stepOrder,
          lastReminderAt: null,
          ...columns,
          metadata: toJson({ ...meta, candidateIds: candidates }),
        },
      });
      return { id: requestId, status: "PENDING", currentStep: next.stepOrder };
    }
    const subscriptionId = await finalise(tx, request, actor, now, columns);
    return {
      id: requestId,
      status: "APPROVED",
      currentStep: step.stepOrder,
      subscriptionId,
    };
  };

  const result =
    "$transaction" in db
      ? await db.$transaction((tx) => run(tx))
      : await run(db);

  if (result.status === "APPROVED") {
    await notifyRequesterDecided(
      toRef(request),
      request.requesterId,
      "APPROVED",
      comment,
      decidedDetails(request, columns)
    );
  } else if (next) {
    const candidates = meta.stepCandidates?.[String(next.stepOrder)] ?? [
      next.approverId,
    ];
    await notifyApprovalRequested(
      toRef(request),
      candidates,
      `step-${next.stepOrder}`
    );
  }
  return result;
}

/** `input` carries the rejection reason + comment; a string is the legacy comment. */
export async function rejectRequest(
  organizationId: string,
  actor: Actor,
  requestId: string,
  input: string | Partial<RejectCapture>,
  now: Date = new Date(),
  db: Db = prisma
): Promise<DecisionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  const step = assertDecidable(request, actor);
  const { comment, reason } = await resolveRejectCapture(
    db,
    organizationId,
    toRejectCapture(input)
  );

  const run = async (tx: Db) => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: {
        status: "REJECTED",
        approverId: actor.userId,
        comment,
        decidedAt: now,
      },
    });
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        decidedAt: now,
        rejectionReasonId: reason?.id ?? null,
        rejectionReasonName: reason?.name ?? null,
        decisionComment: comment,
        metadata: toJson({ ...readMetadata(request), candidateIds: [] }),
      },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "REJECTED",
      comment,
      metadata: {
        stepOrder: step.stepOrder,
        stepLabel: step.label,
        ...(reason ? { reason } : {}),
      },
    });
  };
  if ("$transaction" in db) await db.$transaction((tx) => run(tx));
  else await run(db);

  await notifyRequesterDecided(
    toRef(request),
    request.requesterId,
    "REJECTED",
    comment,
    { reason: reason?.name ?? null }
  );
  return { id: requestId, status: "REJECTED", currentStep: step.stepOrder };
}
