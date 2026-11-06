// src/lib/services/approval/subscription-creator.ts
/**
 * Feature 2.7 — when the final approval lands and
 * `approvals.autoCreateSubscription` is on, materialise the request as an
 * `App` (find-or-create) plus an ACTIVE `Subscription` owned by the requester.
 */
import { prisma } from "@/lib/db";
import type { BillingCycle, Prisma } from "@prisma/client";
import { recordApprovalEvent, recordAudit } from "./audit";
import { addMonths, type CycleMonths } from "./cycle";

type Db = Prisma.TransactionClient | typeof prisma;

export interface SubscriptionSource {
  id: string;
  organizationId: string;
  requesterId: string;
  serviceName: string;
  catalogId: string | null;
  categoryId: string | null;
  costCenterId: string | null;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  seats: number | null;
  /** Effective start date agreed at approval; defaults to the approval time. */
  startDate?: Date | null;
}

export interface CreateSubscriptionOptions {
  cycleMonths: CycleMonths;
  reminderLeadDays: number[];
  actorId: string | null;
  now?: Date;
}

async function findOrCreateApp(db: Db, source: SubscriptionSource) {
  const byName: Prisma.AppWhereInput = {
    name: { equals: source.serviceName, mode: "insensitive" },
  };
  const existing = await db.app.findFirst({
    where: {
      organizationId: source.organizationId,
      OR: source.catalogId
        ? [{ catalogId: source.catalogId }, byName]
        : [byName],
    },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await db.app.create({
    data: {
      organizationId: source.organizationId,
      name: source.serviceName,
      catalogId: source.catalogId,
      categoryId: source.categoryId,
      ownerId: source.requesterId,
      source: "MANUAL",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  await recordAudit(db, {
    organizationId: source.organizationId,
    userId: source.requesterId,
    action: "CREATE_APP",
    entityType: "app",
    entityId: created.id,
    changes: { name: source.serviceName, fromApprovalRequestId: source.id },
  });
  return created.id;
}

export async function createSubscriptionFromRequest(
  db: Db,
  source: SubscriptionSource,
  options: CreateSubscriptionOptions
): Promise<string> {
  const now = options.now ?? new Date();
  const months = options.cycleMonths[source.billingCycle] ?? 0;
  const start = source.startDate ?? now;
  const appId = await findOrCreateApp(db, source);
  const subscription = await db.subscription.create({
    data: {
      appId,
      organizationId: source.organizationId,
      status: "ACTIVE",
      billingCycle: source.billingCycle,
      billingType: "FLAT_RATE",
      amount: source.amount,
      currency: source.currency,
      totalLicenses: source.seats,
      startDate: start,
      renewalDate: months > 0 ? addMonths(start, months) : null,
      autoRenewal: months > 0,
      categoryId: source.categoryId,
      costCenterId: source.costCenterId,
      ownerId: source.requesterId,
      reminderLeadDays: options.reminderLeadDays,
    },
    select: { id: true },
  });
  await db.approvalRequest.update({
    where: { id: source.id },
    data: { subscriptionId: subscription.id },
  });
  await recordApprovalEvent(db, {
    organizationId: source.organizationId,
    requestId: source.id,
    actorId: options.actorId,
    type: "SUBSCRIPTION_CREATED",
    metadata: { subscriptionId: subscription.id, appId },
  });
  await recordAudit(db, {
    organizationId: source.organizationId,
    userId: options.actorId,
    action: "CREATE_SUBSCRIPTION",
    entityType: "subscription",
    entityId: subscription.id,
    changes: { fromApprovalRequestId: source.id, appId },
  });
  return subscription.id;
}
