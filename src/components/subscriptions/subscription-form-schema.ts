import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import { BillingCycle, BillingType, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";

const optionalDate = z.string().nullish().or(z.literal(""));
const optionalId = z.string().nullish().or(z.literal(""));
const MAX_NOTES = 1000;
const MAX_NOTICE_DAYS = 365;

export function createSubscriptionFormSchema(t: (key: string) => string) {
  return z
    .object({
      // Vendor: either an existing app id or a (catalog or free-text) name
      appId: z.string().nullish().or(z.literal("")),
      appName: z.string().trim().max(200).nullish().or(z.literal("")),
      catalogId: optionalId,
      appWebsite: z.string().nullish().or(z.literal("")),
      appLogoUrl: z.string().nullish().or(z.literal("")),
      billingCycle: z.nativeEnum(BillingCycle, {
        errorMap: () => ({
          message: t("subscriptions.form.validation.billingCycleRequired"),
        }),
      }),
      billingType: z.nativeEnum(BillingType).default(BillingType.FLAT_RATE),
      amount: z
        .string()
        .min(1, t("subscriptions.form.validation.amountRequired"))
        .regex(
          /^\d+(\.\d{1,2})?$/,
          t("subscriptions.form.validation.amountInvalid")
        ),
      currency: z.string().default(DEFAULT_BASE_CURRENCY),
      totalLicenses: z.coerce.number().int().positive().nullish(),
      usedLicenses: z.coerce.number().int().min(0).nullish(),
      startDate: z
        .string()
        .min(1, t("subscriptions.form.validation.startDateRequired")),
      endDate: optionalDate,
      renewalDate: optionalDate,
      autoRenewal: z.coerce.boolean().default(true),
      renewalAlert30: z.coerce.boolean().default(true),
      renewalAlert60: z.coerce.boolean().default(false),
      renewalAlert90: z.coerce.boolean().default(false),
      contractUrl: z
        .string()
        .url(t("subscriptions.form.validation.contractUrlInvalid"))
        .nullish()
        .or(z.literal("")),
      notes: z
        .string()
        .max(MAX_NOTES, t("subscriptions.form.validation.notesTooLong"))
        .nullish(),
      status: z.nativeEnum(SubscriptionStatus).optional(),
      // Team/User 배정 (Phase 2)
      teamId: z.string().nullish(),
      // Team 배정 (다중, Phase 3)
      teamIds: z.array(z.string()).default([]),
      assignedUserIds: z.array(z.string()).default([]),
      // Classification
      categoryId: optionalId,
      paymentMethodId: optionalId,
      costCenterId: optionalId,
      taxRateId: optionalId,
      tagNames: z.array(z.string()).default([]),
      customFields: z.record(z.string(), z.string()).default({}),
      // Trial / contract terms / reminders
      isTrial: z.coerce.boolean().default(false),
      trialEndsAt: optionalDate,
      noticePeriodDays: z.coerce
        .number()
        .int()
        .min(0)
        .max(MAX_NOTICE_DAYS)
        .nullish(),
      reminderLeadDays: z.array(z.number().int().min(0)).default([]),
      // Ownership
      isPersonal: z.coerce.boolean().default(false),
      ownerId: optionalId,
      // Cancellation overrides
      cancellationUrl: z
        .string()
        .url(t("subscriptions.form.validation.contractUrlInvalid"))
        .nullish()
        .or(z.literal("")),
      cancellationNotes: z.string().max(2000).nullish(),
    })
    .refine((data) => Boolean(data.appId) || Boolean(data.appName?.trim()), {
      message: t("subscriptions.form.validation.appRequired"),
      path: ["appName"],
    });
}

export type SubscriptionFormValues = z.infer<
  ReturnType<typeof createSubscriptionFormSchema>
>;
