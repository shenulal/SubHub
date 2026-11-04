// src/lib/validations/notifications.ts
import { z } from "zod";

export const NOTIFICATION_EVENT_TYPES = [
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
] as const;

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL", "PUSH"] as const;
export const DEVICE_PLATFORMS = ["IOS", "ANDROID", "WEB"] as const;

export const LIST_PAGE_SIZE_DEFAULT = 20;
export const LIST_PAGE_SIZE_MAX = 100;
export const BELL_PREVIEW_SIZE = 8;

export const notificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);

export const listNotificationsSchema = z.object({
  cursor: z.string().min(1).nullable().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(LIST_PAGE_SIZE_DEFAULT),
  unreadOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true")
    .default(false),
  types: z.array(notificationEventTypeSchema).optional(),
});
export type ListNotificationsInput = z.input<typeof listNotificationsSchema>;

export const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkReadInput = z.infer<typeof markReadSchema>;

export const registerDeviceTokenSchema = z.object({
  platform: z.enum(DEVICE_PLATFORMS),
  token: z.string().min(16).max(4096),
  deviceName: z.string().max(120).optional().nullable(),
});
export type RegisterDeviceTokenInput = z.infer<
  typeof registerDeviceTokenSchema
>;

export const deleteDeviceTokenSchema = z.union([
  z.object({ token: z.string().min(1) }),
  z.object({ id: z.string().min(1) }),
]);

export const preferenceCellSchema = z.object({
  eventType: notificationEventTypeSchema,
  channel: notificationChannelSchema,
  enabled: z.boolean(),
});

export const updatePreferencesSchema = z.object({
  cells: z.array(preferenceCellSchema).max(200).optional(),
  reminderLeadDays: z
    .array(z.coerce.number().int().min(0).max(365))
    .max(10)
    .optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

/** Admin section: organisation-level notification defaults (registry keys + legacy flags). */
export const organizationNotificationDefaultsSchema = z.object({
  digestEnabled: z.boolean().optional(),
  digestWeekday: z.coerce.number().int().min(0).max(6).optional(),
  digestTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  costAnomalyThresholdPercent: z.coerce.number().min(1).max(500).optional(),
  copyApproversOnRenewal: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  enabledChannels: z.array(notificationChannelSchema).min(1).optional(),
  // legacy JSON flags kept for the scans that still read them
  offboardingAlerts: z.boolean().optional(),
  shadowITAlerts: z.boolean().optional(),
  costAnomalyAlerts: z.boolean().optional(),
});
export type OrganizationNotificationDefaultsInput = z.infer<
  typeof organizationNotificationDefaultsSchema
>;
