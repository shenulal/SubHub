// src/lib/services/approval/reminders.ts
/**
 * Feature 2.6 — reminder, escalation and expiry sweep (run by the
 * `approval-reminders` cron). Timing comes from the matched policy, falling
 * back to the `approvals.*` organisation settings.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSettings } from "@/lib/settings/service";
import { recordApprovalEvent } from "./audit";
import { daysBetween } from "./cycle";
import {
  notifyEscalated,
  notifyExpired,
  notifyReminder,
} from "./notifications";
import {
  currentStepOf,
  readMetadata,
  REQUEST_INCLUDE,
  toJson,
  toRef,
  type LoadedRequest,
} from "./shared";
import { usersForEscalation } from "./step-resolver";

export interface ReminderRunResult {
  scanned: number;
  reminded: number;
  escalated: number;
  expired: number;
}

const SETTING_KEYS = [
  "approvals.defaultReminderAfterDays",
  "approvals.defaultEscalationAfterDays",
  "approvals.escalateToRole",
  "approvals.requestExpiryDays",
] as const;

type OrgSettings = Awaited<
  ReturnType<typeof getSettings<(typeof SETTING_KEYS)[number]>>
>;

async function expire(request: LoadedRequest, now: Date) {
  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      status: "CANCELLED",
      decidedAt: now,
      metadata: toJson({
        ...readMetadata(request),
        candidateIds: [],
        expired: true,
      }),
    },
  });
  await prisma.approvalStep.updateMany({
    where: { requestId: request.id, status: { in: ["PENDING", "WAITING"] } },
    data: { status: "SKIPPED" },
  });
  await recordApprovalEvent(prisma, {
    organizationId: request.organizationId,
    requestId: request.id,
    actorId: null,
    type: "CANCELLED",
    metadata: { expired: true },
  });
  await notifyExpired(toRef(request), request.requesterId);
}

async function escalate(
  request: LoadedRequest,
  role: "ADMIN" | "APPROVER",
  now: Date
): Promise<boolean> {
  const targets = await usersForEscalation(request.organizationId, role);
  const meta = readMetadata(request);
  const current = meta.candidateIds ?? [];
  const added = targets.filter((id) => !current.includes(id));
  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: {
      escalatedAt: now,
      metadata: toJson({
        ...meta,
        candidateIds: Array.from(new Set([...current, ...targets])),
        escalatedTo: targets,
      }),
    },
  });
  await recordApprovalEvent(prisma, {
    organizationId: request.organizationId,
    requestId: request.id,
    actorId: null,
    type: "ESCALATED",
    metadata: { role, userIds: targets },
  });
  await notifyEscalated(toRef(request), added.length ? added : targets);
  return true;
}

async function remind(
  request: LoadedRequest,
  approverIds: string[],
  now: Date
) {
  await prisma.approvalRequest.update({
    where: { id: request.id },
    data: { lastReminderAt: now },
  });
  await recordApprovalEvent(prisma, {
    organizationId: request.organizationId,
    requestId: request.id,
    actorId: null,
    type: "REMINDED",
    metadata: { userIds: approverIds },
  });
  await notifyReminder(toRef(request), approverIds);
}

async function processOne(
  request: LoadedRequest,
  settings: OrgSettings,
  now: Date,
  result: ReminderRunResult
) {
  const expiryDays = settings["approvals.requestExpiryDays"];
  if (expiryDays && daysBetween(request.submittedAt, now) >= expiryDays) {
    await expire(request, now);
    result.expired += 1;
    return;
  }
  const step = currentStepOf(request);
  if (!step || step.status !== "PENDING") return;
  const pendingSince = step.updatedAt ?? request.submittedAt;
  const escalationDays =
    request.policy?.escalationAfterDays ??
    settings["approvals.defaultEscalationAfterDays"];
  if (
    !request.escalatedAt &&
    escalationDays > 0 &&
    daysBetween(pendingSince, now) >= escalationDays
  ) {
    await escalate(request, settings["approvals.escalateToRole"], now);
    result.escalated += 1;
    return;
  }
  const reminderDays =
    request.policy?.reminderAfterDays ??
    settings["approvals.defaultReminderAfterDays"];
  const lastTouch = request.lastReminderAt ?? pendingSince;
  if (reminderDays > 0 && daysBetween(lastTouch, now) >= reminderDays) {
    const approvers = readMetadata(request).candidateIds ?? [step.approverId];
    await remind(
      request,
      approvers.length ? approvers : [step.approverId],
      now
    );
    result.reminded += 1;
  }
}

export async function processApprovalReminders(
  now: Date = new Date()
): Promise<ReminderRunResult> {
  const requests = await prisma.approvalRequest.findMany({
    where: { status: "PENDING" },
    include: REQUEST_INCLUDE,
  });
  const result: ReminderRunResult = {
    scanned: requests.length,
    reminded: 0,
    escalated: 0,
    expired: 0,
  };
  const settingsByOrg = new Map<string, OrgSettings>();
  for (const request of requests) {
    try {
      let settings = settingsByOrg.get(request.organizationId);
      if (!settings) {
        settings = await getSettings(request.organizationId, SETTING_KEYS);
        settingsByOrg.set(request.organizationId, settings);
      }
      await processOne(request, settings, now, result);
    } catch (error) {
      logger.error(
        { err: error, requestId: request.id },
        "[approvals] reminder sweep failed for request"
      );
    }
  }
  return result;
}
