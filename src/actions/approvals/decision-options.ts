// src/actions/approvals/decision-options.ts
"use server";

/**
 * Options for the shared decision dialog: active rejection reasons, active
 * cost centres and whether an approval comment is mandatory. Approvers do not
 * need `masters:read` — `approvals:decide` is enough to see the pick lists.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { DecisionFormOptions } from "@/types/approval";
import { runAction } from "./shared";

async function _getDecisionFormOptions(): Promise<
  ActionState<DecisionFormOptions>
> {
  return runAction("getDecisionFormOptions", async () => {
    const { organizationId, permissions } =
      await requirePermission("approvals:decide");
    const [requireApproveComment, reasons, costCenters] = await Promise.all([
      getSetting(organizationId, "approvals.requireApproveComment"),
      prisma.approvalRejectionReason.findMany({
        where: { organizationId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, description: true },
      }),
      prisma.costCenter.findMany({
        where: { organizationId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
    ]);
    const canManage = permissions.has("masters:manage");
    return {
      success: true,
      data: {
        requireApproveComment,
        reasons,
        costCenters,
        canManageCostCenters: canManage,
        canManageReasons: canManage,
      },
    };
  });
}
export const getDecisionFormOptions = withLogging(
  "getDecisionFormOptions",
  _getDecisionFormOptions
);
