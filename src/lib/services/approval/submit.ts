// src/lib/services/approval/submit.ts
/**
 * Feature 2.1 + policy matching — creates an approval request, resolves the
 * governing policy into concrete approver steps and notifies the first approver.
 * When approvals are disabled, no policy matches, or every step resolves to
 * nobody, the request is auto-approved (and the subscription created when
 * `approvals.autoCreateSubscription` is on).
 */
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import type { CreateApprovalRequestInput } from "@/lib/validations/approvals";
import type { ApprovalRequestMetadata } from "@/types/approval";
import type { ApprovalRequestStatus } from "@prisma/client";
import { recordApprovalEvent } from "./audit";
import { addDays, computeMonthlyAmount, getCycleMonths } from "./cycle";
import {
  notifyApprovalRequested,
  notifyRequesterDecided,
} from "./notifications";
import { matchPolicy } from "./policy-matcher";
import { ApprovalError, type Db } from "./shared";
import { resolveSteps, type ResolvedStep } from "./step-resolver";
import { createSubscriptionFromRequest } from "./subscription-creator";

export interface SubmitParams {
  organizationId: string;
  requesterId: string;
  data: CreateApprovalRequestInput;
  now?: Date;
}

export interface SubmitResult {
  id: string;
  status: ApprovalRequestStatus;
  autoApproved: boolean;
  policyId: string | null;
}

const SETTING_KEYS = [
  "approvals.enabled",
  "approvals.allowSelfApproval",
  "approvals.defaultReminderAfterDays",
  "approvals.autoCreateSubscription",
  "subscriptions.defaultReminderLeadDays",
] as const;

function buildMetadata(
  resolved: ResolvedStep[],
  active: ResolvedStep[],
  autoApproved: boolean
): ApprovalRequestMetadata {
  return {
    stepCandidates: Object.fromEntries(
      active.map((s) => [String(s.stepOrder), s.candidateIds])
    ),
    candidateIds: active[0]?.candidateIds ?? [],
    autoApproved,
    skippedSteps: resolved
      .filter((s) => s.candidateIds.length === 0)
      .map((s) => s.label),
  };
}

export async function submitApprovalRequest(
  params: SubmitParams,
  db: Db = prisma
): Promise<SubmitResult> {
  const { organizationId, requesterId, data } = params;
  const now = params.now ?? new Date();
  const [settings, cycleMonths, requester] = await Promise.all([
    getSettings(organizationId, SETTING_KEYS),
    getCycleMonths(organizationId, db),
    db.user.findFirst({
      where: { id: requesterId, organizationId },
      select: {
        id: true,
        managerId: true,
        teamId: true,
        name: true,
        email: true,
      },
    }),
  ]);
  if (!requester) throw new ApprovalError("NOT_FOUND", "Requester not found");

  const monthlyAmount = computeMonthlyAmount(
    data.amount,
    cycleMonths[data.billingCycle]
  );
  const policy = settings["approvals.enabled"]
    ? await matchPolicy(
        organizationId,
        { monthlyAmount, currency: data.currency, categoryId: data.categoryId },
        db
      )
    : null;
  const resolved = policy
    ? await resolveSteps(
        organizationId,
        policy.steps,
        requester,
        { allowSelfApproval: settings["approvals.allowSelfApproval"] },
        db
      )
    : [];
  const active = resolved.filter((s) => s.candidateIds.length > 0);
  const autoApproved = active.length === 0;
  const reminderDays =
    policy?.reminderAfterDays ?? settings["approvals.defaultReminderAfterDays"];
  const metadata = buildMetadata(resolved, active, autoApproved);
  const status: ApprovalRequestStatus = autoApproved ? "APPROVED" : "PENDING";

  const run = async (tx: Db) => {
    const request = await tx.approvalRequest.create({
      data: {
        organizationId,
        requesterId,
        policyId: policy?.id ?? null,
        catalogId: data.catalogId,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId,
        serviceName: data.serviceName,
        vendorWebsite: data.vendorWebsite,
        amount: data.amount,
        currency: data.currency,
        billingCycle: data.billingCycle,
        monthlyAmount,
        seats: data.seats,
        justification: data.justification,
        status,
        currentStep: active[0]?.stepOrder ?? 1,
        submittedAt: now,
        decidedAt: autoApproved ? now : null,
        metadata: metadata as object,
      },
      select: { id: true },
    });
    if (!autoApproved) {
      await tx.approvalStep.createMany({
        data: active.map((s, index) => ({
          requestId: request.id,
          stepOrder: s.stepOrder,
          label: s.label,
          approverId: s.candidateIds[0],
          status: index === 0 ? "PENDING" : "WAITING",
          dueAt: index === 0 ? addDays(now, reminderDays) : null,
        })),
      });
    }
    await recordApprovalEvent(tx, {
      organizationId,
      requestId: request.id,
      actorId: requesterId,
      type: "SUBMITTED",
      metadata: {
        policyId: policy?.id ?? null,
        policyName: policy?.name ?? null,
        monthlyAmount,
        currency: data.currency,
      },
    });
    if (autoApproved) {
      await recordApprovalEvent(tx, {
        organizationId,
        requestId: request.id,
        actorId: null,
        type: "APPROVED",
        metadata: {
          autoApproved: true,
          reason: policy ? "no_approver" : "no_policy",
        },
      });
      if (settings["approvals.autoCreateSubscription"]) {
        await createSubscriptionFromRequest(
          tx,
          { ...data, id: request.id, organizationId, requesterId },
          {
            cycleMonths,
            reminderLeadDays: settings["subscriptions.defaultReminderLeadDays"],
            actorId: null,
            now,
          }
        );
      }
    }
    return request.id;
  };

  const id =
    "$transaction" in db
      ? await db.$transaction((tx) => run(tx))
      : await run(db);

  const ref = {
    id,
    organizationId,
    serviceName: data.serviceName,
    requesterName: requester.name ?? requester.email,
    monthlyAmount,
    currency: data.currency,
  };
  if (autoApproved) {
    await notifyRequesterDecided(ref, requesterId, "APPROVED");
  } else {
    await notifyApprovalRequested(
      ref,
      active[0].candidateIds,
      `step-${active[0].stepOrder}`
    );
  }
  return { id, status, autoApproved, policyId: policy?.id ?? null };
}
