// src/actions/approvals/submit.ts
"use server";

/**
 * Feature 2.1 — submit an approval request.
 */
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { submitApprovalRequest as submitService } from "@/lib/services/approval/submit";
import { getSettings } from "@/lib/settings/service";
import { buildCreateApprovalRequestSchema } from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type { ApprovalRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { runAction } from "./shared";

export interface SubmitApprovalResult {
  id: string;
  status: ApprovalRequestStatus;
  autoApproved: boolean;
}

async function _submitApprovalRequest(
  input: unknown
): Promise<ActionState<SubmitApprovalResult>> {
  return runAction("submitApprovalRequest", async () => {
    const { organizationId, userId } =
      await requirePermission("approvals:create");
    const settings = await getSettings(organizationId, [
      "approvals.justificationMinLength",
      "finance.enabledCurrencies",
    ] as const);
    const schema = buildCreateApprovalRequestSchema({
      justificationMinLength: settings["approvals.justificationMinLength"],
      currencies: settings["finance.enabledCurrencies"],
    });
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please check the highlighted fields",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const result = await submitService({
      organizationId,
      requesterId: userId,
      data: parsed.data,
    });
    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        id: result.id,
        status: result.status,
        autoApproved: result.autoApproved,
      },
    };
  });
}
export const submitApprovalRequest = withLogging(
  "submitApprovalRequest",
  _submitApprovalRequest
);
