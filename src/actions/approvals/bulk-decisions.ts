// src/actions/approvals/bulk-decisions.ts
"use server";

/**
 * Bulk approve / reject from the inbox. Every request goes through the same
 * service call as a single decision (pending check, approver membership,
 * reason lookup), so one bad row never blocks the others; the outcome is
 * reported per request and summarised in the audit log.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { recordAudit } from "@/lib/services/approval/audit";
import * as decision from "@/lib/services/approval/decision";
import { isApprovalError, type Actor } from "@/lib/services/approval/shared";
import { getSetting } from "@/lib/settings/service";
import {
  bulkDecisionSchema,
  type BulkDecisionInput,
} from "@/lib/validations/approval-decisions";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { runAction } from "./shared";

export interface BulkDecisionResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

const INVALID = (errors: Record<string, string[]>): ActionState<never> => ({
  success: false,
  error: "Please check your input",
  errors,
});

function preflight(
  data: ReturnType<typeof bulkDecisionSchema.parse>,
  requireComment: boolean
): Record<string, string[]> | null {
  if (data.action === "approve" && requireComment && !data.comment) {
    return { comment: ["A comment is required to approve"] };
  }
  if (data.action === "reject") {
    const errors: Record<string, string[]> = {};
    if (!data.reasonId) errors.reasonId = ["Choose a rejection reason"];
    if (!data.comment) errors.comment = ["A comment is required to reject"];
    return Object.keys(errors).length ? errors : null;
  }
  return null;
}

async function decideOne(
  organizationId: string,
  actor: Actor,
  id: string,
  data: ReturnType<typeof bulkDecisionSchema.parse>
): Promise<string | null> {
  try {
    if (data.action === "approve") {
      await decision.approveRequest(organizationId, actor, id, {
        comment: data.comment,
      });
    } else {
      await decision.rejectRequest(organizationId, actor, id, {
        reasonId: data.reasonId,
        comment: data.comment ?? "",
      });
    }
    return null;
  } catch (error) {
    if (isApprovalError(error)) return error.message;
    throw error;
  }
}

async function _bulkDecideRequests(
  raw: BulkDecisionInput
): Promise<ActionState<BulkDecisionResult>> {
  return runAction("bulkDecideRequests", async () => {
    const ctx = await requirePermission("approvals:decide");
    const parsed = bulkDecisionSchema.safeParse(raw);
    if (!parsed.success) return INVALID(parsed.error.flatten().fieldErrors);
    const data = parsed.data;
    const requireComment = await getSetting(
      ctx.organizationId,
      "approvals.requireApproveComment"
    );
    const invalid = preflight(data, requireComment);
    if (invalid) return INVALID(invalid);

    const actor: Actor = {
      userId: ctx.userId,
      role: ctx.role,
      permissions: ctx.permissions,
    };
    const result: BulkDecisionResult = { succeeded: [], failed: [] };
    for (const id of Array.from(new Set(data.requestIds))) {
      const error = await decideOne(ctx.organizationId, actor, id, data);
      if (error) result.failed.push({ id, error });
      else result.succeeded.push(id);
    }
    await recordAudit(prisma, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "BULK_APPROVAL_DECISION",
      entityType: "approval_request",
      entityId: ctx.organizationId,
      changes: {
        decision: data.action,
        reasonId: data.reasonId,
        comment: data.comment,
        succeeded: result.succeeded,
        failed: result.failed,
      },
    });
    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    if (data.action === "approve") revalidatePath("/subscriptions");
    return { success: true, data: result };
  });
}
export const bulkDecideRequests = withLogging(
  "bulkDecideRequests",
  _bulkDecideRequests
);
