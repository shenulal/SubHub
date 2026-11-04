// src/actions/platform/masters/billing-cycles.ts
"use server";

import {
  ActionError,
  toActionError,
  writeAudit,
} from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { billingCycleInputSchema } from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { BillingCycleRow } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { queryBillingCycles } from "./queries";

const MASTERS_PATH = "/settings/masters";

async function _listBillingCycles(): Promise<ActionState<BillingCycleRow[]>> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    return { success: true, data: await queryBillingCycles(organizationId) };
  } catch (error) {
    return toActionError(error, "listBillingCycles");
  }
}
export const listBillingCycles = withLogging(
  "listBillingCycles",
  _listBillingCycles
);

async function _updateBillingCycle(raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = billingCycleInputSchema.parse(raw);
    if (input.cycle !== "ONE_TIME" && input.months < 1) {
      throw new ActionError("Recurring cycles need at least one month");
    }
    if (input.cycle === "ONE_TIME" && input.months !== 0) {
      throw new ActionError("One-time cycles must have 0 months");
    }
    const existing = await prisma.billingCycleConfig.findUnique({
      where: { organizationId_cycle: { organizationId, cycle: input.cycle } },
    });
    if (!input.isEnabled) {
      const enabledOthers = await prisma.billingCycleConfig.count({
        where: { organizationId, isEnabled: true, cycle: { not: input.cycle } },
      });
      if (enabledOthers === 0)
        throw new ActionError("At least one billing cycle must stay enabled");
    }
    await prisma.billingCycleConfig.upsert({
      where: { organizationId_cycle: { organizationId, cycle: input.cycle } },
      create: {
        organizationId,
        cycle: input.cycle,
        label: input.label,
        months: input.months,
        isEnabled: input.isEnabled,
      },
      update: {
        label: input.label,
        months: input.months,
        isEnabled: input.isEnabled,
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_BILLING_CYCLE",
      entityType: "BillingCycleConfig",
      entityId: input.cycle,
      changes: {
        from: existing
          ? {
              label: existing.label,
              months: existing.months,
              isEnabled: existing.isEnabled,
            }
          : null,
        to: {
          label: input.label,
          months: input.months,
          isEnabled: input.isEnabled,
        },
      },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updateBillingCycle");
  }
}
export const updateBillingCycle = withLogging(
  "updateBillingCycle",
  _updateBillingCycle
);
