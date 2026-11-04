// src/actions/approvals/policies.ts
"use server";

/**
 * Features 2.2 / 2.3 — approval policy CRUD with priority ordering and
 * ordered approver steps.
 */
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { recordAudit } from "@/lib/services/approval/audit";
import {
  reorderPoliciesSchema,
  upsertPolicySchema,
  type UpsertPolicyData,
} from "@/lib/validations/approvals";
import type { ActionState } from "@/types";
import type { ApprovalPolicyView } from "@/types/approval";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { runAction, USER_REF_SELECT } from "./shared";

const POLICY_PATH = "/settings/approvals";
const POLICY_ENTITY = "approval_policy";

const POLICY_INCLUDE = {
  steps: {
    orderBy: { stepOrder: "asc" as const },
    include: { approverUser: { select: USER_REF_SELECT } },
  },
  _count: { select: { requests: true } },
} satisfies Prisma.ApprovalPolicyInclude;

type PolicyRow = Prisma.ApprovalPolicyGetPayload<{
  include: typeof POLICY_INCLUDE;
}>;

function toView(row: PolicyRow): ApprovalPolicyView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    priority: row.priority,
    appliesToAll: row.appliesToAll,
    costThreshold:
      row.costThreshold === null ? null : Number(row.costThreshold),
    costThresholdCurrency: row.costThresholdCurrency,
    categoryIds: row.categoryIds,
    reminderAfterDays: row.reminderAfterDays,
    escalationAfterDays: row.escalationAfterDays,
    steps: row.steps.map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      label: s.label,
      approverType: s.approverType,
      approverUserId: s.approverUserId,
      approverRole: s.approverRole,
      approverUser: s.approverUser,
    })),
    requestCount: row._count.requests,
  };
}

async function _getApprovalPolicies(): Promise<
  ActionState<ApprovalPolicyView[]>
> {
  return runAction("getApprovalPolicies", async () => {
    const { organizationId } = await requirePermission(
      "approval_policies:read"
    );
    const rows = await prisma.approvalPolicy.findMany({
      where: { organizationId },
      include: POLICY_INCLUDE,
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    return { success: true, data: rows.map(toView) };
  });
}
export const getApprovalPolicies = withLogging(
  "getApprovalPolicies",
  _getApprovalPolicies
);

async function validateReferences(
  organizationId: string,
  data: UpsertPolicyData
): Promise<string | null> {
  const userIds = data.steps
    .map((s) => (s.approverType === "USER" ? s.approverUserId : null))
    .filter((id): id is string => Boolean(id));
  const [categories, users] = await Promise.all([
    data.categoryIds.length
      ? prisma.category.count({
          where: { organizationId, id: { in: data.categoryIds } },
        })
      : Promise.resolve(0),
    userIds.length
      ? prisma.user.count({ where: { organizationId, id: { in: userIds } } })
      : Promise.resolve(0),
  ]);
  if (categories !== data.categoryIds.length)
    return "Unknown category selected";
  if (users !== new Set(userIds).size) return "Unknown approver selected";
  return null;
}

function stepRows(
  data: UpsertPolicyData
): Prisma.ApprovalPolicyStepCreateManyPolicyInput[] {
  return data.steps.map((s, index) => ({
    stepOrder: index + 1,
    label: s.label,
    approverType: s.approverType,
    approverUserId: s.approverType === "USER" ? s.approverUserId : null,
    approverRole: s.approverType === "ROLE" ? s.approverRole : null,
  }));
}

function policyData(data: UpsertPolicyData) {
  return {
    name: data.name,
    description: data.description,
    isActive: data.isActive,
    appliesToAll: data.appliesToAll,
    costThreshold: data.appliesToAll ? null : data.costThreshold,
    costThresholdCurrency: data.costThresholdCurrency,
    categoryIds: data.appliesToAll ? [] : data.categoryIds,
    reminderAfterDays: data.reminderAfterDays,
    escalationAfterDays: data.escalationAfterDays,
  };
}

async function _upsertApprovalPolicy(
  input: unknown
): Promise<ActionState<ApprovalPolicyView>> {
  return runAction("upsertApprovalPolicy", async () => {
    const { organizationId, userId } = await requirePermission(
      "approval_policies:manage"
    );
    const parsed = upsertPolicySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please check the highlighted fields",
        errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const data = parsed.data;
    const refError = await validateReferences(organizationId, data);
    if (refError) return { success: false, error: refError };

    const row = await prisma.$transaction(async (tx) => {
      if (data.id) {
        const existing = await tx.approvalPolicy.findFirst({
          where: { id: data.id, organizationId },
          select: { id: true },
        });
        if (!existing) throw new Error("Policy not found");
        await tx.approvalPolicyStep.deleteMany({
          where: { policyId: data.id },
        });
        const updated = await tx.approvalPolicy.update({
          where: { id: data.id },
          data: {
            ...policyData(data),
            steps: { createMany: { data: stepRows(data) } },
          },
          include: POLICY_INCLUDE,
        });
        await recordAudit(tx, {
          organizationId,
          userId,
          action: "UPDATE_APPROVAL_POLICY",
          entityType: POLICY_ENTITY,
          entityId: updated.id,
          changes: policyData(data),
        });
        return updated;
      }
      const top = await tx.approvalPolicy.aggregate({
        where: { organizationId },
        _max: { priority: true },
      });
      const created = await tx.approvalPolicy.create({
        data: {
          organizationId,
          priority: (top._max.priority ?? 0) + 1,
          ...policyData(data),
          steps: { createMany: { data: stepRows(data) } },
        },
        include: POLICY_INCLUDE,
      });
      await recordAudit(tx, {
        organizationId,
        userId,
        action: "CREATE_APPROVAL_POLICY",
        entityType: POLICY_ENTITY,
        entityId: created.id,
        changes: policyData(data),
      });
      return created;
    });
    revalidatePath(POLICY_PATH);
    return { success: true, data: toView(row) };
  });
}
export const upsertApprovalPolicy = withLogging(
  "upsertApprovalPolicy",
  _upsertApprovalPolicy
);

async function _deleteApprovalPolicy(id: string): Promise<ActionState<null>> {
  return runAction("deleteApprovalPolicy", async () => {
    const { organizationId, userId } = await requirePermission(
      "approval_policies:manage"
    );
    const existing = await prisma.approvalPolicy.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    });
    if (!existing) return { success: false, error: "Policy not found" };
    await prisma.approvalPolicy.delete({ where: { id } });
    await recordAudit(prisma, {
      organizationId,
      userId,
      action: "DELETE_APPROVAL_POLICY",
      entityType: POLICY_ENTITY,
      entityId: id,
      changes: { name: existing.name },
    });
    revalidatePath(POLICY_PATH);
    return { success: true, data: null };
  });
}
export const deleteApprovalPolicy = withLogging(
  "deleteApprovalPolicy",
  _deleteApprovalPolicy
);

async function _setPolicyActive(
  id: string,
  isActive: boolean
): Promise<ActionState<null>> {
  return runAction("setPolicyActive", async () => {
    const { organizationId, userId } = await requirePermission(
      "approval_policies:manage"
    );
    const updated = await prisma.approvalPolicy.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });
    if (updated.count === 0)
      return { success: false, error: "Policy not found" };
    await recordAudit(prisma, {
      organizationId,
      userId,
      action: "UPDATE_APPROVAL_POLICY",
      entityType: POLICY_ENTITY,
      entityId: id,
      changes: { isActive },
    });
    revalidatePath(POLICY_PATH);
    return { success: true, data: null };
  });
}
export const setPolicyActive = withLogging("setPolicyActive", _setPolicyActive);

async function _reorderApprovalPolicies(
  orderedIds: string[]
): Promise<ActionState<null>> {
  return runAction("reorderApprovalPolicies", async () => {
    const { organizationId, userId } = await requirePermission(
      "approval_policies:manage"
    );
    const parsed = reorderPoliciesSchema.safeParse({ orderedIds });
    if (!parsed.success) return { success: false, error: "Invalid order" };
    const ids = parsed.data.orderedIds;
    const owned = await prisma.approvalPolicy.count({
      where: { organizationId, id: { in: ids } },
    });
    if (owned !== ids.length)
      return { success: false, error: "Unknown policy" };
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.approvalPolicy.update({
          where: { id },
          data: { priority: ids.length - index },
        })
      )
    );
    await recordAudit(prisma, {
      organizationId,
      userId,
      action: "REORDER_APPROVAL_POLICIES",
      entityType: POLICY_ENTITY,
      entityId: organizationId,
      changes: { orderedIds: ids },
    });
    revalidatePath(POLICY_PATH);
    return { success: true, data: null };
  });
}
export const reorderApprovalPolicies = withLogging(
  "reorderApprovalPolicies",
  _reorderApprovalPolicies
);
