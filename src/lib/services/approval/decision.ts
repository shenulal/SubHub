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
  now: Date
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
      categoryId: request.categoryId,
      costCenterId: request.costCenterId,
      amount: Number(request.amount),
      currency: request.currency,
      billingCycle: request.billingCycle,
      seats: request.seats,
    },
    {
      cycleMonths,
      reminderLeadDays: settings["subscriptions.defaultReminderLeadDays"],
      actorId: actor.userId,
      now,
    }
  );
}

export async function approveRequest(
  organizationId: string,
  actor: Actor,
  requestId: string,
  comment?: string | null,
  now: Date = new Date(),
  db: Db = prisma
): Promise<DecisionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  const step = assertDecidable(request, actor);
  const next = nextWaitingStep(request);
  const reminderDays = await reminderDaysFor(organizationId, request.policy);
  const meta = readMetadata(request);

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
          metadata: toJson({ ...meta, candidateIds: candidates }),
        },
      });
      return { id: requestId, status: "PENDING", currentStep: next.stepOrder };
    }
    const subscriptionId = await finalise(tx, request, actor, now);
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
      comment
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

export async function rejectRequest(
  organizationId: string,
  actor: Actor,
  requestId: string,
  comment: string,
  now: Date = new Date(),
  db: Db = prisma
): Promise<DecisionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  const step = assertDecidable(request, actor);

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
        metadata: toJson({ ...readMetadata(request), candidateIds: [] }),
      },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "REJECTED",
      comment,
      metadata: { stepOrder: step.stepOrder, stepLabel: step.label },
    });
  };
  if ("$transaction" in db) await db.$transaction((tx) => run(tx));
  else await run(db);

  await notifyRequesterDecided(
    toRef(request),
    request.requesterId,
    "REJECTED",
    comment
  );
  return { id: requestId, status: "REJECTED", currentStep: step.stepOrder };
}
