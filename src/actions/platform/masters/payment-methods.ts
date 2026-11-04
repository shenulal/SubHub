// src/actions/platform/masters/payment-methods.ts
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
  paymentMethodInputSchema,
  reorderSchema,
  type PaymentMethodInput,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import type { MasterOption, PaymentMethodRow } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { queryPaymentMethods } from "./queries";

const MASTERS_PATH = "/settings/masters";

async function assertCard(
  organizationId: string,
  corporateCardId: string | null | undefined
) {
  if (!corporateCardId) return;
  const card = await prisma.corporateCard.findFirst({
    where: { id: corporateCardId, organizationId },
    select: { id: true },
  });
  if (!card) throw new ActionError("Corporate card not found");
}

function toData(input: PaymentMethodInput) {
  return {
    code: input.code.toUpperCase(),
    name: input.name,
    kind: input.kind,
    corporateCardId:
      input.kind === "CARD" ? (input.corporateCardId ?? null) : null,
    isActive: input.isActive,
    isDefault: input.isDefault,
  };
}

async function _listPaymentMethods(): Promise<ActionState<PaymentMethodRow[]>> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    return { success: true, data: await queryPaymentMethods(organizationId) };
  } catch (error) {
    return toActionError(error, "listPaymentMethods");
  }
}
export const listPaymentMethods = withLogging(
  "listPaymentMethods",
  _listPaymentMethods
);

async function _listCorporateCardOptions(): Promise<
  ActionState<MasterOption[]>
> {
  try {
    const { organizationId } = await requirePermission("masters:read");
    const cards = await prisma.corporateCard.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, cardNm: true, cardLast4: true, cardCd: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      success: true,
      data: cards.map((c) => ({
        id: c.id,
        label: [
          c.cardNm ?? c.cardCd,
          c.cardLast4 ? `•••• ${c.cardLast4}` : null,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    };
  } catch (error) {
    return toActionError(error, "listCorporateCardOptions");
  }
}
export const listCorporateCardOptions = withLogging(
  "listCorporateCardOptions",
  _listCorporateCardOptions
);

async function _createPaymentMethod(
  raw: unknown
): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = paymentMethodInputSchema.parse(raw);
    await assertCard(organizationId, input.corporateCardId);
    const data = toData(input);
    const [duplicate, last] = await Promise.all([
      prisma.paymentMethodOption.findFirst({
        where: { organizationId, code: data.code },
        select: { id: true },
      }),
      prisma.paymentMethodOption.findFirst({
        where: { organizationId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      }),
    ]);
    if (duplicate)
      throw new ActionError(`Code "${data.code}" is already in use`);
    const created = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.paymentMethodOption.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.paymentMethodOption.create({
        data: {
          organizationId,
          ...data,
          sortOrder: (last?.sortOrder ?? -1) + 1,
        },
      });
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_PAYMENT_METHOD",
      entityType: "PaymentMethodOption",
      entityId: created.id,
      changes: { to: data },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    return toActionError(error, "createPaymentMethod");
  }
}
export const createPaymentMethod = withLogging(
  "createPaymentMethod",
  _createPaymentMethod
);

async function _updatePaymentMethod(
  id: string,
  raw: unknown
): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const input = paymentMethodInputSchema.parse(raw);
    await assertCard(organizationId, input.corporateCardId);
    const existing = await prisma.paymentMethodOption.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new ActionError("Payment method not found");
    const data = toData(input);
    const duplicate = await prisma.paymentMethodOption.findFirst({
      where: { organizationId, code: data.code, id: { not: id } },
      select: { id: true },
    });
    if (duplicate)
      throw new ActionError(`Code "${data.code}" is already in use`);
    await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.paymentMethodOption.updateMany({
          where: { organizationId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      await tx.paymentMethodOption.update({ where: { id }, data });
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_PAYMENT_METHOD",
      entityType: "PaymentMethodOption",
      entityId: id,
      changes: {
        from: {
          code: existing.code,
          name: existing.name,
          kind: existing.kind,
          isActive: existing.isActive,
          isDefault: existing.isDefault,
        },
        to: data,
      },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "updatePaymentMethod");
  }
}
export const updatePaymentMethod = withLogging(
  "updatePaymentMethod",
  _updatePaymentMethod
);

async function _deletePaymentMethod(id: string): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const existing = await prisma.paymentMethodOption.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!existing) throw new ActionError("Payment method not found");
    const inUse = existing._count.subscriptions > 0;
    if (inUse)
      await prisma.paymentMethodOption.update({
        where: { id },
        data: { isActive: false, isDefault: false },
      });
    else await prisma.paymentMethodOption.delete({ where: { id } });
    await writeAudit({
      organizationId,
      userId,
      action: inUse ? "DEACTIVATE_PAYMENT_METHOD" : "DELETE_PAYMENT_METHOD",
      entityType: "PaymentMethodOption",
      entityId: id,
      changes: { from: { code: existing.code } },
    });
    revalidatePath(MASTERS_PATH);
    return {
      success: true,
      message: inUse ? "In use — deactivated instead of deleted" : undefined,
    };
  } catch (error) {
    return toActionError(error, "deletePaymentMethod");
  }
}
export const deletePaymentMethod = withLogging(
  "deletePaymentMethod",
  _deletePaymentMethod
);

async function _reorderPaymentMethods(raw: unknown): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("masters:manage");
    const { ids } = reorderSchema.parse(raw);
    const owned = await prisma.paymentMethodOption.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length)
      throw new ActionError("Unknown payment method in order list");
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.paymentMethodOption.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
    await writeAudit({
      organizationId,
      userId,
      action: "REORDER_PAYMENT_METHODS",
      entityType: "PaymentMethodOption",
      metadata: { ids },
    });
    revalidatePath(MASTERS_PATH);
    return { success: true };
  } catch (error) {
    return toActionError(error, "reorderPaymentMethods");
  }
}
export const reorderPaymentMethods = withLogging(
  "reorderPaymentMethods",
  _reorderPaymentMethods
);
