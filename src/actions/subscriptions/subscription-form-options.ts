"use server";

/**
 * Option lists and defaults for the subscription form, resolved from settings
 * and master data (never hard-coded in the client).
 */
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings/service";
import type { BillingCycle } from "@prisma/client";

export interface SubscriptionFormOptions {
  currencies: string[];
  baseCurrency: string;
  billingCycles: Array<{ cycle: BillingCycle; label: string; months: number }>;
  defaultBillingCycle: BillingCycle;
  paymentMethods: Array<{ id: string; name: string; isDefault: boolean }>;
  costCenters: Array<{ id: string; code: string; name: string }>;
  taxRates: Array<{
    id: string;
    name: string;
    ratePercent: number;
    isDefault: boolean;
  }>;
  owners: Array<{ id: string; name: string | null; email: string }>;
  currentUserId: string;
  defaultNoticePeriodDays: number | null;
  reminderLeadDayOptions: number[];
  defaultReminderLeadDays: number[];
  allowPersonalSubscriptions: boolean;
}

const OWNER_LIMIT = 500;

export async function getSubscriptionFormOptions(): Promise<SubscriptionFormOptions> {
  const { organizationId, userId } = await requireOrganization();
  const [
    settings,
    billingCycles,
    paymentMethods,
    costCenters,
    taxRates,
    owners,
  ] = await Promise.all([
    getSettings(organizationId, [
      "finance.enabledCurrencies",
      "finance.baseCurrency",
      "subscriptions.defaultBillingCycle",
      "subscriptions.defaultNoticePeriodDays",
      "subscriptions.reminderLeadDayOptions",
      "subscriptions.defaultReminderLeadDays",
      "subscriptions.allowPersonalSubscriptions",
    ]),
    prisma.billingCycleConfig.findMany({
      where: { organizationId, isEnabled: true },
      orderBy: { sortOrder: "asc" },
      select: { cycle: true, label: true, months: true },
    }),
    prisma.paymentMethodOption.findMany({
      where: { organizationId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, isDefault: true },
    }),
    prisma.costCenter.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.taxRate.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, ratePercent: true, isDefault: true },
    }),
    prisma.user.findMany({
      where: { organizationId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      take: OWNER_LIMIT,
      select: { id: true, name: true, email: true },
    }),
  ]);

  const base = settings["finance.baseCurrency"];
  const enabled = settings["finance.enabledCurrencies"];
  return {
    currencies: enabled.includes(base) ? enabled : [base, ...enabled],
    baseCurrency: base,
    billingCycles,
    defaultBillingCycle: settings["subscriptions.defaultBillingCycle"],
    paymentMethods,
    costCenters,
    taxRates: taxRates.map((t) => ({
      ...t,
      ratePercent: Number(t.ratePercent),
    })),
    owners,
    currentUserId: userId,
    defaultNoticePeriodDays: settings["subscriptions.defaultNoticePeriodDays"],
    reminderLeadDayOptions: settings["subscriptions.reminderLeadDayOptions"],
    defaultReminderLeadDays: settings["subscriptions.defaultReminderLeadDays"],
    allowPersonalSubscriptions:
      settings["subscriptions.allowPersonalSubscriptions"],
  };
}
