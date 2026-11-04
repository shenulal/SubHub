// src/lib/services/approval/cycle.ts
/**
 * Billing-cycle helpers. Month counts come from the organisation's
 * `BillingCycleConfig` master rows; the in-code table is only a safety net
 * for organisations that have not been seeded yet.
 */
import { prisma } from "@/lib/db";
import type { BillingCycle, Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export type CycleMonths = Record<BillingCycle, number>;

const FALLBACK_CYCLE_MONTHS: CycleMonths = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
  ONE_TIME: 0,
};

const MONEY_DECIMALS = 2;

export async function getCycleMonths(
  organizationId: string,
  db: Db = prisma
): Promise<CycleMonths> {
  const rows = await db.billingCycleConfig.findMany({
    where: { organizationId },
    select: { cycle: true, months: true },
  });
  const months: CycleMonths = { ...FALLBACK_CYCLE_MONTHS };
  for (const row of rows) months[row.cycle] = row.months;
  return months;
}

export function roundMoney(value: number, decimals = MONEY_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Monthly-normalised amount; one-time purchases do not recur (0 / month). */
export function computeMonthlyAmount(amount: number, months: number): number {
  if (!Number.isFinite(amount) || months <= 0) return 0;
  return roundMoney(amount / months);
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
}
