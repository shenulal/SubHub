// src/lib/services/approval/request-actions.ts
/**
 * Feature 2.4 (continued) — request info / provide info loop, cancellation and
 * free-form comments on an approval request.
 */
import { prisma } from "@/lib/db";
import type { ApprovalRequestStatus } from "@prisma/client";
import { recordApprovalEvent } from "./audit";
import { addDays } from "./cycle";
import { notifyApprovalRequested, notifyInfoRequested } from "./notifications";
import {
  ApprovalError,
  canDecide,
  currentStepOf,
  isAdmin,
  loadRequest,
  readMetadata,
  reminderDaysFor,
  toJson,
  toRef,
  type Actor,
  type Db,
  type LoadedRequest,
} from "./shared";

export interface RequestActionResult {
  id: string;
  status: ApprovalRequestStatus;
}

const CANCELLABLE: ApprovalRequestStatus[] = ["PENDING", "INFO_REQUESTED"];

function isParticipant(actor: Actor, request: LoadedRequest): boolean {
  if (isAdmin(actor) || actor.permissions.has("approvals:read_all"))
    return true;
  if (request.requesterId === actor.userId) return true;
  if (request.steps.some((s) => s.approverId === actor.userId)) return true;
  const meta = readMetadata(request);
  return Object.values(meta.stepCandidates ?? {}).some((ids) =>
    ids.includes(actor.userId)
  );
}

export async function requestInfo(
  organizationId: string,
  actor: Actor,
  requestId: string,
  comment: string,
  now: Date = new Date(),
  db: Db = prisma
): Promise<RequestActionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  if (request.status !== "PENDING") {
    throw new ApprovalError("NOT_PENDING", "This request is no longer pending");
  }
  const step = currentStepOf(request);
  if (!step || !canDecide(actor, request, step)) {
    throw new ApprovalError(
      "NOT_APPROVER",
      "You are not an approver for the current step"
    );
  }
  const run = async (tx: Db) => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: "INFO_REQUESTED", approverId: actor.userId, comment },
    });
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: { status: "INFO_REQUESTED" },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "INFO_REQUESTED",
      comment,
      metadata: { stepOrder: step.stepOrder },
    });
  };
  if ("$transaction" in db) await db.$transaction((tx) => run(tx));
  else await run(db);
  await notifyInfoRequested(toRef(request), request.requesterId, comment);
  void now;
  return { id: requestId, status: "INFO_REQUESTED" };
}

export async function provideInfo(
  organizationId: string,
  actor: Actor,
  requestId: string,
  comment: string,
  now: Date = new Date(),
  db: Db = prisma
): Promise<RequestActionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  if (request.requesterId !== actor.userId) {
    throw new ApprovalError("NOT_REQUESTER", "Only the requester can answer");
  }
  if (request.status !== "INFO_REQUESTED") {
    throw new ApprovalError("INVALID_STATE", "No information was requested");
  }
  const step = currentStepOf(request);
  if (!step) throw new ApprovalError("INVALID_STATE", "Current step missing");
  const reminderDays = await reminderDaysFor(organizationId, request.policy);
  const run = async (tx: Db) => {
    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: "PENDING", dueAt: addDays(now, reminderDays) },
    });
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: { status: "PENDING", lastReminderAt: null },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "INFO_PROVIDED",
      comment,
      metadata: { stepOrder: step.stepOrder },
    });
  };
  if ("$transaction" in db) await db.$transaction((tx) => run(tx));
  else await run(db);
  const candidates = readMetadata(request).candidateIds ?? [step.approverId];
  await notifyApprovalRequested(
    toRef(request),
    candidates,
    `info-${now.getTime()}`
  );
  return { id: requestId, status: "PENDING" };
}

export async function cancelRequest(
  organizationId: string,
  actor: Actor,
  requestId: string,
  comment?: string | null,
  now: Date = new Date(),
  db: Db = prisma
): Promise<RequestActionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  const allowed =
    request.requesterId === actor.userId ||
    actor.permissions.has("approvals:cancel_any");
  if (!allowed) {
    throw new ApprovalError("FORBIDDEN", "You cannot cancel this request");
  }
  if (!CANCELLABLE.includes(request.status)) {
    throw new ApprovalError(
      "INVALID_STATE",
      "Only open requests can be cancelled"
    );
  }
  const run = async (tx: Db) => {
    await tx.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: "CANCELLED",
        decidedAt: now,
        metadata: toJson({ ...readMetadata(request), candidateIds: [] }),
      },
    });
    await tx.approvalStep.updateMany({
      where: {
        requestId,
        status: { in: ["PENDING", "WAITING", "INFO_REQUESTED"] },
      },
      data: { status: "SKIPPED" },
    });
    await recordApprovalEvent(tx, {
      organizationId,
      requestId,
      actorId: actor.userId,
      type: "CANCELLED",
      comment,
    });
  };
  if ("$transaction" in db) await db.$transaction((tx) => run(tx));
  else await run(db);
  return { id: requestId, status: "CANCELLED" };
}

export async function addComment(
  organizationId: string,
  actor: Actor,
  requestId: string,
  body: string,
  db: Db = prisma
): Promise<RequestActionResult> {
  const request = await loadRequest(db, organizationId, requestId);
  if (!isParticipant(actor, request)) {
    throw new ApprovalError("FORBIDDEN", "You cannot comment on this request");
  }
  await recordApprovalEvent(db, {
    organizationId,
    requestId,
    actorId: actor.userId,
    type: "COMMENTED",
    comment: body,
  });
  return { id: requestId, status: request.status };
}
