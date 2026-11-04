// src/lib/validations/platform.ts
import { SETTING_GROUPS, type SettingGroupKey } from "@/lib/settings/registry";
import { z } from "zod";

const ISO_CURRENCY = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code expected");
const ISO_COUNTRY = z
  .string()
  .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 expected");
const CODE = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9_-]+$/i, "Letters, digits, dash and underscore only");
const NAME = z.string().trim().min(1).max(80);
const OPTIONAL_TEXT = z.string().trim().max(500).optional().nullable();
const ID = z.string().min(1);
const OPTIONAL_ID = z.string().min(1).optional().nullable();
const DATE_STRING = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const settingGroupKeySchema = z.enum(
  Object.keys(SETTING_GROUPS) as [SettingGroupKey, ...SettingGroupKey[]]
);

export const workspaceSettingsUpdateSchema = z.object({
  group: settingGroupKeySchema,
  values: z.record(z.string(), z.unknown()),
});

export const settingKeySchema = z.string().regex(/^[a-z]+\.[A-Za-z0-9]+$/);

// ─── Masters ──────────────────────────────────────────────────────
export const currencyToggleSchema = z.object({
  code: ISO_CURRENCY,
  enabled: z.boolean(),
});

export const manualRateSchema = z.object({
  baseCurrency: ISO_CURRENCY,
  quoteCurrency: ISO_CURRENCY,
  rate: z.coerce.number().positive().max(1_000_000),
  asOf: DATE_STRING.optional(),
});

export const taxRateInputSchema = z.object({
  name: NAME,
  countryCode: ISO_COUNTRY.optional().nullable(),
  ratePercent: z.coerce.number().min(0).max(100),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  validFrom: DATE_STRING.optional().nullable(),
  validTo: DATE_STRING.optional().nullable(),
});
export type TaxRateInput = z.infer<typeof taxRateInputSchema>;

export const costCenterInputSchema = z.object({
  code: CODE,
  name: NAME,
  description: OPTIONAL_TEXT,
  ownerId: OPTIONAL_ID,
  teamId: OPTIONAL_ID,
  budgetMonthly: z.coerce.number().min(0).optional().nullable(),
  budgetCurrency: ISO_CURRENCY.optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CostCenterInput = z.infer<typeof costCenterInputSchema>;

export const paymentMethodKindSchema = z.enum([
  "CARD",
  "BANK",
  "INVOICE",
  "WALLET",
  "OTHER",
]);

export const paymentMethodInputSchema = z.object({
  code: CODE,
  name: NAME,
  kind: paymentMethodKindSchema,
  corporateCardId: OPTIONAL_ID,
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodInputSchema>;

export const reorderSchema = z.object({ ids: z.array(ID).min(1) });

export const billingCycleSchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_TIME",
]);

export const billingCycleInputSchema = z.object({
  cycle: billingCycleSchema,
  label: NAME,
  months: z.coerce.number().int().min(0).max(120),
  isEnabled: z.boolean().default(true),
});
export type BillingCycleInput = z.infer<typeof billingCycleInputSchema>;

// ─── Roles ────────────────────────────────────────────────────────
export const roleInputSchema = z.object({
  name: NAME,
  description: OPTIONAL_TEXT,
  permissionKeys: z.array(z.string().regex(/^[a-z_]+:[a-z_]+$/)).max(200),
});
export type RoleInput = z.infer<typeof roleInputSchema>;

export const assignRoleSchema = z.object({
  userId: ID,
  /** Role row id (system or custom); null clears to the user's legacy role */
  roleId: ID.nullable(),
});

// ─── Notification templates ───────────────────────────────────────
export const notificationEventTypeSchema = z.enum([
  "RENEWAL_REMINDER",
  "TRIAL_ENDING",
  "PRICE_CHANGE",
  "NOTICE_PERIOD",
  "APPROVAL_REQUESTED",
  "APPROVAL_DECIDED",
  "APPROVAL_INFO_REQUESTED",
  "APPROVAL_ESCALATED",
  "APPROVER_RENEWAL",
  "OFFBOARDING",
  "SHADOW_IT",
  "COST_ANOMALY",
  "PENDING_REVIEW",
  "RECEIPT_SUGGESTION",
  "DIGEST",
  "SYSTEM",
]);
export const notificationChannelSchema = z.enum(["IN_APP", "EMAIL", "PUSH"]);

export const notificationTemplateInputSchema = z.object({
  eventType: notificationEventTypeSchema,
  channel: notificationChannelSchema,
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/)
    .default("en"),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(5000),
  isActive: z.boolean().default(true),
});
export type NotificationTemplateInput = z.infer<
  typeof notificationTemplateInputSchema
>;

export const notificationTemplateKeySchema =
  notificationTemplateInputSchema.pick({
    eventType: true,
    channel: true,
    locale: true,
  });

export function zodIssuesToErrors(error: z.ZodError): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}
