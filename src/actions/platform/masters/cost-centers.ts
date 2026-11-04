// src/actions/platform/masters/cost-centers.ts
"use server";

import {
  ActionError,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { getSettings } from "@/lib/settings/service";
import {
  costCenterInputSchema,
  type CostCenterInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { CostCenterRow, MasterOption } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { queryCostCenters } from "./queries";

const MASTERS_PATH = "/settings/masters";

export interface CostCenterOptions {
  owners: MasterOption[];
  teams: MasterOption[];
  currencies: string[];
  baseCurrency: string;
}

async function assertReferences(
  organizationId: string,
  input: CostCenterInput
) {
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: { id: input.ownerId, organizationId },
      select: { id: true },
    });
    if (!owner)
      throw new ActionError("Owner must be a member of this organisation");
  }
  if (input.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: input.teamId, organizationId },
      select: { id: true },
    });
    if (!team) throw new ActionError("Team not found");
  }
}

function toData(input: CostCenterInput) {
  return {
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description ?? null,
    ownerId: input.ownerId ?? null,
    teamId: input.teamId ?? null,
    budgetMonthly: input.budgetMonthly ?? null,
    budgetCurrency:
      input.budgetMonthly != null ? (input.budgetCurrency ?? null) : null,
    isActive: input.isActive,
  };
}

async function _listCostCenters(): Promise<ActionState<CostCenterRow[]>> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    return { success: true, data: await queryCostCenters(organizationId) };
  } catch (error) {
    return toActionError(error, "listCostCenters");
  }
}
export const listCostCenters = withLogging("listCostCenters", _listCostCenters);

async function _listCostCenterOptions(): Promise<
  ActionState<CostCenterOptions>
> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    const [users, teams, settings] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.team.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getSettings(organizationId, [
        "finance.baseCurrency",
        "finance.enabledCurrencies",
      ]),
    ]);
    return {
      success: true,
      data: {
        owners: users.map((u) => ({ id: u.id, label: u.name ?? u.email })),
        teams: teams.map((t) => ({ id: t.id, label: t.name })),
        currencies: Array.from(
          new Set([
            settings["finance.baseCurrency"],
            ...settings["finance.enabledCurrencies"],
          ])
        ),
        baseCurrency: settings["finance.baseCurrency"],
      },
    };
  } catch (error) {
    return toActionError(error, "listCostCenterOptions");
  }
}
export const listCostCenterOptions = withLogging(
  "listCostCenterOptions",
  _listCostCenterOptions
);

async function _createCostCenter(
  raw: unknown
): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = costCenterInputSchema.parse(raw);
    await assertReferences(organizationId, input);
    const data = toData(input);
    const duplicate = await prisma.costCenter.findFirst({
      where: { organizationId, code: data.code },
      select: { id: true },
    });
    if (duplicate)
      throw new ActionError(`Code "${data.code}" is already in use`);
    const created = await prisma.costCenter.create({
      data: { organizationId, ...data },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_COST_CENTER",
      entityType: "CostCenter",
      entityId: created.id,
      changes: { to: data },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return toActionError(error, "createCostCenter");
  }
}
export const createCostCenter = withLogging(
  "createCostCenter",
  _createCostCenter
);

async function _updateCostCenter(
  id: string,
  raw: unknown
): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = costCenterInputSchema.parse(raw);
    await assertReferences(organizationId, input);
    const existing = await prisma.costCenter.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new ActionError("Cost centre not found");
    const data = toData(input);
    const duplicate = await prisma.costCenter.findFirst({
      where: { organizationId, code: data.code, id: { not: id } },
      select: { id: true },
    });
    if (duplicate)
      throw new ActionError(`Code "${data.code}" is already in use`);
    await prisma.costCenter.update({ where: { id }, data });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_COST_CENTER",
      entityType: "CostCenter",
      entityId: id,
      changes: {
        from: {
          code: existing.code,
          name: existing.name,
          isActive: existing.isActive,
          budgetMonthly: existing.budgetMonthly
            ? Number(existing.budgetMonthly)
            : null,
        },
        to: data,
      },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateCostCenter");
  }
}
export const updateCostCenter = withLogging(
  "updateCostCenter",
  _updateCostCenter
);

async function _deleteCostCenter(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const existing = await prisma.costCenter.findFirst({
      where: { id, organizationId },
      include: {
        _count: { select: { subscriptions: true, approvalRequests: true } },
      },
    });
    if (!existing) throw new ActionError("Cost centre not found");
    const inUse =
      existing._count.subscriptions + existing._count.approvalRequests > 0;
    if (inUse)
      await prisma.costCenter.update({
        where: { id },
        data: { isActive: false },
      });
    else await prisma.costCenter.delete({ where: { id } });
    await writeAudit({
      organizationId,
      userId,
      action: inUse ? "DEACTIVATE_COST_CENTER" : "DELETE_COST_CENTER",
      entityType: "CostCenter",
      entityId: id,
      changes: { from: { code: existing.code, name: existing.name } },
    });
    revalidatePath(MASTERS_PATH);
    return {
      success: true,
      message: inUse ? "In use — deactivated instead of deleted" : undefined,
    };
  } catch (error) {
    return toActionError(error, "deleteCostCenter");
  }
}
export const deleteCostCenter = withLogging(
  "deleteCostCenter",
  _deleteCostCenter
);
