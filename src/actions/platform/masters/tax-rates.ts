// src/actions/platform/masters/tax-rates.ts
"use server";

import {
  ActionError,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  taxRateInputSchema,
  type TaxRateInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { TaxRateRow } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { queryTaxRates } from "./queries";

const MASTERS_PATH = "/settings/masters";

function toData(input: TaxRateInput) {
  return {
    name: input.name,
    countryCode: input.countryCode ?? null,
    ratePercent: input.ratePercent,
    isDefault: input.isDefault,
    isActive: input.isActive,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
  };
}

function assertValidity(input: TaxRateInput): void {
  if (
    input.validFrom &&
    input.validTo &&
    new Date(input.validTo) < new Date(input.validFrom)
  ) {
    throw new ActionError("Valid-to must be after valid-from");
  }
}

async function _listTaxRates(): Promise<ActionState<TaxRateRow[]>> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    return { success: true, data: await queryTaxRates(organizationId) };
  } catch (error) {
    return toActionError(error, "listTaxRates");
  }
}
export const listTaxRates = withLogging("listTaxRates", _listTaxRates);

async function _createTaxRate(
  raw: unknown
): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = taxRateInputSchema.parse(raw);
    assertValidity(input);
    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.taxRate.create({ data: { organizationId, ...toData(input) } });
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_TAX_RATE",
      entityType: "TaxRate",
      entityId: created.id,
      changes: { to: input },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return toActionError(error, "createTaxRate");
  }
}
export const createTaxRate = withLogging("createTaxRate", _createTaxRate);

async function _updateTaxRate(id: string, raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = taxRateInputSchema.parse(raw);
    assertValidity(input);
    const existing = await prisma.taxRate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new ActionError("Tax rate not found");
    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.taxRate.update({ where: { id }, data: toData(input) });
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_TAX_RATE",
      entityType: "TaxRate",
      entityId: id,
      changes: {
        from: {
          name: existing.name,
          ratePercent: Number(existing.ratePercent),
          isDefault: existing.isDefault,
          isActive: existing.isActive,
        },
        to: input,
      },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateTaxRate");
  }
}
export const updateTaxRate = withLogging("updateTaxRate", _updateTaxRate);

async function _deleteTaxRate(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const existing = await prisma.taxRate.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!existing) throw new ActionError("Tax rate not found");
    if (existing._count.subscriptions > 0) {
      await prisma.taxRate.update({
        where: { id },
        data: { isActive: false, isDefault: false },
      });
    } else {
      await prisma.taxRate.delete({ where: { id } });
    }
    await writeAudit({
      organizationId,
      userId,
      action:
        existing._count.subscriptions > 0
          ? "DEACTIVATE_TAX_RATE"
          : "DELETE_TAX_RATE",
      entityType: "TaxRate",
      entityId: id,
      changes: { from: { name: existing.name } },
    });
    revalidatePath(MASTERS_PATH);
    return {
      success: true,
      message:
        existing._count.subscriptions > 0
          ? "In use by subscriptions — deactivated instead of deleted"
          : undefined,
    };
  } catch (error) {
    return toActionError(error, "deleteTaxRate");
  }
}
export const deleteTaxRate = withLogging("deleteTaxRate", _deleteTaxRate);
