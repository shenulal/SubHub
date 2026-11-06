// src/actions/platform/masters/rejection-reasons.ts
"use server";

/**
 * "Rejection reasons" master (Settings → Master data). Read with
 * `masters:read`, change with `masters:manage`; every change is audited.
 * A reason already used by a request is deactivated instead of deleted.
 */
import {
  ActionError,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { rejectionReasonInputSchema } from "@/lib/validations/approval-decisions";
import type { ActionState } from "@/types";
import type { RejectionReasonRow } from "@/types/approval";
import { revalidatePath } from "next/cache";

const MASTERS_PATH = "/settings/masters";
const ENTITY = "ApprovalRejectionReason";

async function _listRejectionReasons(): Promise<
  ActionState<RejectionReasonRow[]>
> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    const rows = await prisma.approvalRejectionReason.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { requests: true } } },
    });
    return {
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        sortOrder: r.sortOrder,
        isActive: r.isActive,
        usageCount: r._count.requests,
      })),
    };
  } catch (error) {
    return toActionError(error, "listRejectionReasons");
  }
}
export const listRejectionReasons = withLogging(
  "listRejectionReasons",
  _listRejectionReasons
);

async function assertUniqueCode(
  organizationId: string,
  code: string,
  exceptId?: string
) {
  const clash = await prisma.approvalRejectionReason.findFirst({
    where: {
      organizationId,
      code,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new ActionError(`A reason with code ${code} already exists`);
}

async function _createRejectionReason(
  raw: unknown
): Promise<ActionState<{ id: string; name: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = rejectionReasonInputSchema.parse(raw);
    await assertUniqueCode(organizationId, input.code);
    const created = await prisma.approvalRejectionReason.create({
      data: { organizationId, ...input },
      select: { id: true, name: true },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_REJECTION_REASON",
      entityType: ENTITY,
      entityId: created.id,
      changes: { to: input },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true, data: created };
  } catch (error) {
    return toActionError(error, "createRejectionReason");
  }
}
export const createRejectionReason = withLogging(
  "createRejectionReason",
  _createRejectionReason
);

async function _updateRejectionReason(
  id: string,
  raw: unknown
): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = rejectionReasonInputSchema.parse(raw);
    const existing = await prisma.approvalRejectionReason.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new ActionError("Rejection reason not found");
    await assertUniqueCode(organizationId, input.code, id);
    await prisma.approvalRejectionReason.update({
      where: { id },
      data: input,
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_REJECTION_REASON",
      entityType: ENTITY,
      entityId: id,
      changes: {
        from: {
          code: existing.code,
          name: existing.name,
          isActive: existing.isActive,
          sortOrder: existing.sortOrder,
        },
        to: input,
      },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateRejectionReason");
  }
}
export const updateRejectionReason = withLogging(
  "updateRejectionReason",
  _updateRejectionReason
);

async function _deleteRejectionReason(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const existing = await prisma.approvalRejectionReason.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { requests: true } } },
    });
    if (!existing) throw new ActionError("Rejection reason not found");
    const inUse = existing._count.requests > 0;
    if (inUse) {
      await prisma.approvalRejectionReason.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      await prisma.approvalRejectionReason.delete({ where: { id } });
    }
    await writeAudit({
      organizationId,
      userId,
      action: inUse ? "DEACTIVATE_REJECTION_REASON" : "DELETE_REJECTION_REASON",
      entityType: ENTITY,
      entityId: id,
      changes: { from: { code: existing.code, name: existing.name } },
    });
    revalidatePath(MASTERS_PATH);
    return {
      success: true,
      message: inUse
        ? "Used by earlier decisions — deactivated instead of deleted"
        : undefined,
    };
  } catch (error) {
    return toActionError(error, "deleteRejectionReason");
  }
}
export const deleteRejectionReason = withLogging(
  "deleteRejectionReason",
  _deleteRejectionReason
);
