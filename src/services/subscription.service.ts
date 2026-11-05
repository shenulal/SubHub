// src/services/subscription.service.ts
// SMP-203: Subscription CRUD business logic — service layer shared by Server Actions and the Write Tool

import { prisma } from "@/lib/db";
import { getBaseCurrency } from "@/lib/fx/base-currency";

// ==================== Types ====================

export interface SubscriptionServiceContext {
  organizationId: string;
  userId: string;
  role: string;
}

export interface CreateSubscriptionInput {
  appId: string;
  billingCycle: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
  billingType?: "FLAT_RATE" | "PER_SEAT";
  amount: string;
  currency?: string;
  startDate: string;
  endDate?: string | null;
  totalLicenses?: number | null;
  autoRenewal?: boolean;
  notes?: string | null;
}

export interface UpdateSubscriptionInput {
  billingCycle?: "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME";
  billingType?: "FLAT_RATE" | "PER_SEAT";
  amount?: string;
  currency?: string;
  totalLicenses?: number | null;
  status?: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING";
  autoRenewal?: boolean;
  notes?: string | null;
}

export interface ServiceResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

// ==================== Create ====================

export async function createSubscription(
  ctx: SubscriptionServiceContext,
  input: CreateSubscriptionInput
): Promise<ServiceResult<{ id: string }>> {
  // Permission check
  if (ctx.role === "VIEWER") {
    return {
      success: false,
      message: "You do not have permission to create subscriptions",
    };
  }

  // Ensure the app exists
  const app = await prisma.app.findFirst({
    where: { id: input.appId, organizationId: ctx.organizationId },
  });
  if (!app) {
    return { success: false, message: "App not found" };
  }

  // Create the subscription
  const subscription = await prisma.subscription.create({
    data: {
      appId: input.appId,
      organizationId: ctx.organizationId,
      billingCycle: input.billingCycle,
      billingType: input.billingType ?? "FLAT_RATE",
      amount: parseFloat(input.amount),
      currency: input.currency ?? (await getBaseCurrency(ctx.organizationId)),
      totalLicenses: input.totalLicenses ?? null,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
      autoRenewal: input.autoRenewal ?? true,
      notes: input.notes ?? null,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "CREATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { appName: app.name, amount: input.amount },
    },
  });

  return { success: true, data: { id: subscription.id } };
}

// ==================== Update ====================

export async function updateSubscription(
  ctx: SubscriptionServiceContext,
  id: string,
  input: UpdateSubscriptionInput
): Promise<ServiceResult<{ id: string }>> {
  // Permission check
  if (ctx.role !== "ADMIN") {
    return {
      success: false,
      message: "You do not have permission to edit this subscription",
    };
  }

  // Ensure the subscription exists
  const existing = await prisma.subscription.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existing) {
    return { success: false, message: "Subscription not found" };
  }

  // Update the subscription
  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(input.billingCycle && { billingCycle: input.billingCycle }),
      ...(input.billingType && { billingType: input.billingType }),
      ...(input.amount && { amount: parseFloat(input.amount) }),
      ...(input.currency && { currency: input.currency }),
      ...(input.totalLicenses !== undefined && {
        totalLicenses: input.totalLicenses,
      }),
      ...(input.status && { status: input.status }),
      ...(input.autoRenewal !== undefined && {
        autoRenewal: input.autoRenewal,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: subscription.id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { amount: input.amount },
    },
  });

  return { success: true, data: { id: subscription.id } };
}

// ==================== Delete ====================

export async function deleteSubscription(
  ctx: SubscriptionServiceContext,
  id: string
): Promise<ServiceResult> {
  // Permission check
  if (ctx.role !== "ADMIN") {
    return { success: false, message: "Admin permission required" };
  }

  // Ensure the subscription exists
  const existing = await prisma.subscription.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { app: { select: { name: true } } },
  });
  if (!existing) {
    return { success: false, message: "Subscription not found" };
  }

  // Delete
  await prisma.subscription.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "DELETE_SUBSCRIPTION",
      entityType: "Subscription",
      entityId: id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { appName: existing.app.name },
    },
  });

  return { success: true };
}
