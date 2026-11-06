// src/lib/settings/registry.ts
/**
 * SubHub settings registry.
 *
 * Every tunable value in the product is declared here with a zod schema, a default
 * and UI metadata. Nothing in feature code should hard-code a threshold, a default
 * currency, a lead time or a limit — read it through `@/lib/settings/service`.
 *
 * Scope:
 *  - "organization": stored per tenant in `organization_settings`, editable by users
 *    holding `settings:manage` (falls back to the system value, then the default).
 *  - "system": stored once in `system_settings`, editable by SUPER_ADMIN.
 */
import { z } from "zod";

export const SETTING_GROUPS = {
  general: {
    label: "General",
    description: "Locale, time zone, fiscal calendar and regional defaults",
  },
  branding: {
    label: "Branding",
    description: "Product name, logo and accent colour shown to your members",
  },
  finance: {
    label: "Finance & currency",
    description: "Base currency, exchange-rate provider, tax and budgets",
  },
  subscriptions: {
    label: "Subscriptions",
    description:
      "Defaults for new subscriptions, reminders and lifecycle rules",
  },
  approvals: {
    label: "Approvals",
    description: "Default approval behaviour, reminders and escalation",
  },
  notifications: {
    label: "Notifications",
    description: "Channels, digest schedule, quiet hours and sender identity",
  },
  security: {
    label: "Security & access",
    description: "Sign-in rules, sessions, invitations and default role",
  },
  privacy: {
    label: "Privacy & retention",
    description: "Data retention windows and self-service export/deletion",
  },
  documents: {
    label: "Documents",
    description: "Attachment limits and storage provider",
  },
  integrations: {
    label: "Integrations",
    description: "Mailbox scanning, SSO sync and discovery thresholds",
  },
  discovery: {
    label: "Discovery & analytics",
    description: "Dashboard windows, pipeline buckets and anomaly thresholds",
  },
  system: {
    label: "Platform",
    description: "Platform-wide defaults managed by the super administrator",
  },
} as const;

export type SettingGroupKey = keyof typeof SETTING_GROUPS;
export type SettingScope = "organization" | "system";
export type SettingInput =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "secret"
  | "json"
  | "time"
  | "color"
  | "number-list"
  | "string-list";

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> {
  key: string;
  group: SettingGroupKey;
  scope: SettingScope;
  schema: T;
  defaultValue: z.infer<T>;
  label: string;
  description?: string;
  input: SettingInput;
  options?: SettingOption[];
  unit?: string;
  min?: number;
  max?: number;
  /** Secrets are never returned to the browser in full */
  sensitive?: boolean;
  /** Changing this requires the given permission (default settings:manage) */
  permission?: string;
}

function define<T extends z.ZodTypeAny>(
  def: SettingDefinition<T>
): SettingDefinition<T> {
  return def;
}

const ISO_CURRENCY = z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code expected");
const ISO_COUNTRY = z
  .string()
  .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 expected");
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM expected");

export const FX_PROVIDERS: SettingOption[] = [
  { value: "manual", label: "Manual rates only" },
  { value: "frankfurter", label: "Frankfurter (European Central Bank, free)" },
  {
    value: "open_er_api",
    label: "Open Exchange Rates API (open.er-api.com, free)",
  },
  { value: "exchangerate_host", label: "exchangerate.host (API key)" },
  {
    value: "google_finance",
    label: "Google Finance quotes (best effort, no official API)",
  },
];

export const STORAGE_PROVIDERS: SettingOption[] = [
  { value: "local", label: "Local disk (development)" },
  { value: "r2", label: "Cloudflare R2" },
  { value: "s3", label: "Amazon S3 compatible" },
];

export const WEEKDAYS: SettingOption[] = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

/**
 * The catalogue. Keys are dot-namespaced by group.
 */
export const SETTING_DEFINITIONS = {
  // ─── General ─────────────────────────────────────────────────────
  "general.timezone": define({
    key: "general.timezone",
    group: "general",
    scope: "organization",
    schema: z.string().min(1),
    defaultValue: "Asia/Dubai",
    label: "Time zone",
    description: "Used for reminders, digests and date display",
    input: "text",
  }),
  "general.locale": define({
    key: "general.locale",
    group: "general",
    scope: "organization",
    schema: z.enum(["en"]),
    defaultValue: "en",
    label: "Default language",
    input: "select",
    options: [{ value: "en", label: "English" }],
  }),
  "general.countryCode": define({
    key: "general.countryCode",
    group: "general",
    scope: "organization",
    schema: ISO_COUNTRY,
    defaultValue: "AE",
    label: "Country",
    description: "Drives default tax rate and currency suggestions",
    input: "select",
  }),
  "general.dateFormat": define({
    key: "general.dateFormat",
    group: "general",
    scope: "organization",
    schema: z.enum(["dd MMM yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy"]),
    defaultValue: "dd MMM yyyy",
    label: "Date format",
    input: "select",
    options: [
      { value: "dd MMM yyyy", label: "04 Nov 2026" },
      { value: "yyyy-MM-dd", label: "2026-11-04" },
      { value: "dd/MM/yyyy", label: "04/11/2026" },
      { value: "MM/dd/yyyy", label: "11/04/2026" },
    ],
  }),
  "general.weekStartsOn": define({
    key: "general.weekStartsOn",
    group: "general",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(6),
    defaultValue: 1,
    label: "Week starts on",
    input: "select",
    options: WEEKDAYS,
  }),
  "general.fiscalYearStartMonth": define({
    key: "general.fiscalYearStartMonth",
    group: "general",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(12),
    defaultValue: 1,
    label: "Fiscal year starts in month",
    description: "1 = January. Used by annual spend and budget reports",
    input: "number",
    min: 1,
    max: 12,
  }),

  // ─── Branding ────────────────────────────────────────────────────
  "branding.productName": define({
    key: "branding.productName",
    group: "branding",
    scope: "organization",
    schema: z.string().min(1).max(60),
    defaultValue: "SubHub",
    label: "Product name",
    input: "text",
  }),
  "branding.logoUrl": define({
    key: "branding.logoUrl",
    group: "branding",
    scope: "organization",
    schema: z.string().url().or(z.literal("")),
    defaultValue: "",
    label: "Logo URL",
    input: "text",
  }),
  "branding.accentColor": define({
    key: "branding.accentColor",
    group: "branding",
    scope: "organization",
    schema: z.string().regex(/^#([0-9a-fA-F]{6})$/),
    defaultValue: "#4f46e5",
    label: "Accent colour",
    input: "color",
  }),

  // ─── Finance ─────────────────────────────────────────────────────
  "finance.baseCurrency": define({
    key: "finance.baseCurrency",
    group: "finance",
    scope: "organization",
    schema: ISO_CURRENCY,
    defaultValue: "AED",
    label: "Base (reporting) currency",
    description:
      "All totals, budgets and approval thresholds are converted to this currency",
    input: "select",
  }),
  "finance.enabledCurrencies": define({
    key: "finance.enabledCurrencies",
    group: "finance",
    scope: "organization",
    schema: z.array(ISO_CURRENCY).min(1),
    defaultValue: ["AED", "USD", "SAR", "EUR", "GBP"],
    label: "Currencies offered in forms",
    input: "multiselect",
  }),
  "finance.fxProvider": define({
    key: "finance.fxProvider",
    group: "finance",
    scope: "organization",
    schema: z.enum([
      "manual",
      "frankfurter",
      "open_er_api",
      "exchangerate_host",
      "google_finance",
    ]),
    defaultValue: "open_er_api",
    label: "Exchange-rate provider",
    description: "Where daily conversion rates are pulled from",
    input: "select",
    options: FX_PROVIDERS,
  }),
  "finance.fxApiKey": define({
    key: "finance.fxApiKey",
    group: "finance",
    scope: "organization",
    schema: z.string(),
    defaultValue: "",
    label: "Exchange-rate provider API key",
    input: "secret",
    sensitive: true,
  }),
  "finance.fxRefreshHours": define({
    key: "finance.fxRefreshHours",
    group: "finance",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(168),
    defaultValue: 24,
    label: "Refresh rates every",
    unit: "hours",
    input: "number",
    min: 1,
    max: 168,
  }),
  "finance.fxStaleAfterDays": define({
    key: "finance.fxStaleAfterDays",
    group: "finance",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(90),
    defaultValue: 7,
    label: "Warn when rates are older than",
    unit: "days",
    input: "number",
  }),
  "finance.roundingDecimals": define({
    key: "finance.roundingDecimals",
    group: "finance",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(4),
    defaultValue: 2,
    label: "Rounding precision for converted amounts",
    input: "number",
    min: 0,
    max: 4,
  }),
  "finance.pricesIncludeTax": define({
    key: "finance.pricesIncludeTax",
    group: "finance",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Subscription amounts include tax",
    input: "boolean",
  }),
  "finance.monthlyBudget": define({
    key: "finance.monthlyBudget",
    group: "finance",
    scope: "organization",
    schema: z.coerce.number().min(0).nullable(),
    defaultValue: null,
    label: "Organisation monthly budget (base currency)",
    description: "Leave empty to use last month's spend as the reference",
    input: "number",
  }),
  "finance.budgetAlertThresholdPercent": define({
    key: "finance.budgetAlertThresholdPercent",
    group: "finance",
    scope: "organization",
    schema: z.coerce.number().min(1).max(100),
    defaultValue: 80,
    label: "Budget alert at",
    unit: "% of budget",
    input: "number",
  }),

  // ─── Subscriptions ───────────────────────────────────────────────
  "subscriptions.defaultBillingCycle": define({
    key: "subscriptions.defaultBillingCycle",
    group: "subscriptions",
    scope: "organization",
    schema: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"]),
    defaultValue: "MONTHLY",
    label: "Default billing cycle",
    input: "select",
    options: [
      { value: "MONTHLY", label: "Monthly" },
      { value: "QUARTERLY", label: "Quarterly" },
      { value: "YEARLY", label: "Yearly" },
      { value: "ONE_TIME", label: "One-time" },
    ],
  }),
  "subscriptions.reminderLeadDayOptions": define({
    key: "subscriptions.reminderLeadDayOptions",
    group: "subscriptions",
    scope: "organization",
    schema: z.array(z.coerce.number().int().min(0).max(365)).min(1),
    defaultValue: [1, 3, 7, 14, 30],
    label: "Reminder lead times offered",
    unit: "days before renewal",
    input: "number-list",
  }),
  "subscriptions.defaultReminderLeadDays": define({
    key: "subscriptions.defaultReminderLeadDays",
    group: "subscriptions",
    scope: "organization",
    schema: z.array(z.coerce.number().int().min(0).max(365)),
    defaultValue: [7, 3, 1],
    label: "Default reminders for new subscriptions",
    unit: "days before renewal",
    input: "number-list",
  }),
  "subscriptions.trialAlertLeadDays": define({
    key: "subscriptions.trialAlertLeadDays",
    group: "subscriptions",
    scope: "organization",
    schema: z.array(z.coerce.number().int().min(0).max(60)).min(1),
    defaultValue: [2],
    label: "Trial-ending alerts",
    unit: "days before trial end",
    input: "number-list",
  }),
  "subscriptions.defaultNoticePeriodDays": define({
    key: "subscriptions.defaultNoticePeriodDays",
    group: "subscriptions",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(365).nullable(),
    defaultValue: 30,
    label: "Default notice period",
    unit: "days before contract end",
    input: "number",
  }),
  "subscriptions.noticePeriodAlertLeadDays": define({
    key: "subscriptions.noticePeriodAlertLeadDays",
    group: "subscriptions",
    scope: "organization",
    schema: z.array(z.coerce.number().int().min(0).max(90)).min(1),
    defaultValue: [7, 1],
    label: "Notice-window alerts",
    unit: "days before the cancellation deadline",
    input: "number-list",
  }),
  "subscriptions.duplicateSimilarityThreshold": define({
    key: "subscriptions.duplicateSimilarityThreshold",
    group: "subscriptions",
    scope: "organization",
    schema: z.coerce.number().min(0.5).max(1),
    defaultValue: 0.82,
    label: "Duplicate warning similarity",
    description: "0.5 = loose, 1.0 = exact name match only",
    input: "number",
    min: 0.5,
    max: 1,
  }),
  "subscriptions.priceChangeThresholdPercent": define({
    key: "subscriptions.priceChangeThresholdPercent",
    group: "subscriptions",
    scope: "organization",
    schema: z.coerce.number().min(0).max(100),
    defaultValue: 5,
    label: "Flag price changes above",
    unit: "%",
    input: "number",
  }),
  "subscriptions.autoArchiveCancelledAfterDays": define({
    key: "subscriptions.autoArchiveCancelledAfterDays",
    group: "subscriptions",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(3650).nullable(),
    defaultValue: 90,
    label: "Archive cancelled subscriptions after",
    unit: "days (empty = never)",
    input: "number",
  }),
  "subscriptions.allowPersonalSubscriptions": define({
    key: "subscriptions.allowPersonalSubscriptions",
    group: "subscriptions",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Allow members to track personal subscriptions",
    input: "boolean",
  }),
  "subscriptions.maxCustomFields": define({
    key: "subscriptions.maxCustomFields",
    group: "subscriptions",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(20),
    defaultValue: 3,
    label: "Maximum custom fields",
    input: "number",
  }),

  // ─── Approvals ───────────────────────────────────────────────────
  "approvals.enabled": define({
    key: "approvals.enabled",
    group: "approvals",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Approval workflow enabled",
    input: "boolean",
  }),
  "approvals.allowSelfApproval": define({
    key: "approvals.allowSelfApproval",
    group: "approvals",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Requesters may approve their own requests",
    input: "boolean",
  }),
  "approvals.defaultReminderAfterDays": define({
    key: "approvals.defaultReminderAfterDays",
    group: "approvals",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(60),
    defaultValue: 2,
    label: "Remind approver after",
    unit: "days idle",
    input: "number",
  }),
  "approvals.defaultEscalationAfterDays": define({
    key: "approvals.defaultEscalationAfterDays",
    group: "approvals",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(90),
    defaultValue: 5,
    label: "Escalate after",
    unit: "days idle",
    input: "number",
  }),
  "approvals.escalateToRole": define({
    key: "approvals.escalateToRole",
    group: "approvals",
    scope: "organization",
    schema: z.enum(["ADMIN", "APPROVER"]),
    defaultValue: "ADMIN",
    label: "Escalate idle requests to",
    input: "select",
    options: [
      { value: "ADMIN", label: "Administrators" },
      { value: "APPROVER", label: "All approvers" },
    ],
  }),
  "approvals.autoCreateSubscription": define({
    key: "approvals.autoCreateSubscription",
    group: "approvals",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Create the subscription automatically on final approval",
    input: "boolean",
  }),
  "approvals.justificationMinLength": define({
    key: "approvals.justificationMinLength",
    group: "approvals",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(2000),
    defaultValue: 20,
    label: "Minimum justification length",
    unit: "characters",
    input: "number",
  }),
  "approvals.requireApproveComment": define({
    key: "approvals.requireApproveComment",
    group: "approvals",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Approvers must add a comment when approving",
    description:
      "Rejections always need a reason and a comment; this makes the approval comment mandatory too.",
    input: "boolean",
  }),
  "approvals.requestExpiryDays": define({
    key: "approvals.requestExpiryDays",
    group: "approvals",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(365).nullable(),
    defaultValue: 30,
    label: "Auto-cancel pending requests after",
    unit: "days (empty = never)",
    input: "number",
  }),

  // ─── Notifications ───────────────────────────────────────────────
  "notifications.enabledChannels": define({
    key: "notifications.enabledChannels",
    group: "notifications",
    scope: "organization",
    schema: z.array(z.enum(["IN_APP", "EMAIL", "PUSH"])).min(1),
    defaultValue: ["IN_APP", "EMAIL"],
    label: "Channels available to members",
    input: "multiselect",
    options: [
      { value: "IN_APP", label: "In-app" },
      { value: "EMAIL", label: "Email" },
      { value: "PUSH", label: "Mobile push" },
    ],
  }),
  "notifications.digestEnabled": define({
    key: "notifications.digestEnabled",
    group: "notifications",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Weekly digest email",
    input: "boolean",
  }),
  "notifications.digestWeekday": define({
    key: "notifications.digestWeekday",
    group: "notifications",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(6),
    defaultValue: 1,
    label: "Digest day",
    input: "select",
    options: WEEKDAYS,
  }),
  "notifications.digestTime": define({
    key: "notifications.digestTime",
    group: "notifications",
    scope: "organization",
    schema: HHMM,
    defaultValue: "08:00",
    label: "Digest time (organisation time zone)",
    input: "time",
  }),
  "notifications.quietHoursStart": define({
    key: "notifications.quietHoursStart",
    group: "notifications",
    scope: "organization",
    schema: HHMM.nullable(),
    defaultValue: null,
    label: "Quiet hours start",
    description: "Email and push are held until quiet hours end",
    input: "time",
  }),
  "notifications.quietHoursEnd": define({
    key: "notifications.quietHoursEnd",
    group: "notifications",
    scope: "organization",
    schema: HHMM.nullable(),
    defaultValue: null,
    label: "Quiet hours end",
    input: "time",
  }),
  "notifications.emailFromName": define({
    key: "notifications.emailFromName",
    group: "notifications",
    scope: "organization",
    schema: z.string().max(80),
    defaultValue: "SubHub",
    label: "Email sender name",
    input: "text",
  }),
  "notifications.emailReplyTo": define({
    key: "notifications.emailReplyTo",
    group: "notifications",
    scope: "organization",
    schema: z.string().email().or(z.literal("")),
    defaultValue: "",
    label: "Reply-to address",
    input: "text",
  }),
  "notifications.maxInAppItems": define({
    key: "notifications.maxInAppItems",
    group: "notifications",
    scope: "organization",
    schema: z.coerce.number().int().min(20).max(1000),
    defaultValue: 200,
    label: "Keep at most this many in-app notifications per member",
    input: "number",
  }),
  "notifications.copyApproversOnRenewal": define({
    key: "notifications.copyApproversOnRenewal",
    group: "notifications",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Copy approvers on renewals of approved subscriptions",
    input: "boolean",
  }),

  // ─── Security ────────────────────────────────────────────────────
  "security.allowedEmailDomains": define({
    key: "security.allowedEmailDomains",
    group: "security",
    scope: "organization",
    schema: z.array(z.string().min(3)),
    defaultValue: [],
    label: "Restrict sign-ups to these email domains",
    description: "Empty = any domain can be invited",
    input: "string-list",
  }),
  "security.enforceSso": define({
    key: "security.enforceSso",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Require single sign-on (disable password sign-in)",
    description:
      "Takes effect only when an SSO provider (Sign in with Apple) is configured, so members are never locked out",
    input: "boolean",
  }),
  "security.sessionMaxAgeHours": define({
    key: "security.sessionMaxAgeHours",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(720),
    defaultValue: 720,
    label: "Session lifetime",
    unit: "hours",
    input: "number",
  }),
  "security.invitationExpiryDays": define({
    key: "security.invitationExpiryDays",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(90),
    defaultValue: 7,
    label: "Invitations expire after",
    unit: "days",
    input: "number",
  }),
  "security.defaultRoleKey": define({
    key: "security.defaultRoleKey",
    group: "security",
    scope: "organization",
    schema: z.string().min(1),
    defaultValue: "MEMBER",
    label: "Default role for new members",
    input: "select",
  }),
  "security.otpExpiryMinutes": define({
    key: "security.otpExpiryMinutes",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(60),
    defaultValue: 10,
    label: "One-time code validity",
    unit: "minutes",
    input: "number",
  }),
  "security.otpMaxAttempts": define({
    key: "security.otpMaxAttempts",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(20),
    defaultValue: 5,
    label: "One-time code attempts",
    input: "number",
  }),
  "security.passwordMinLength": define({
    key: "security.passwordMinLength",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(8).max(64),
    defaultValue: 10,
    label: "Minimum password length",
    input: "number",
  }),
  "security.passwordRequireUppercase": define({
    key: "security.passwordRequireUppercase",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Passwords need an uppercase letter",
    input: "boolean",
  }),
  "security.passwordRequireLowercase": define({
    key: "security.passwordRequireLowercase",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Passwords need a lowercase letter",
    input: "boolean",
  }),
  "security.passwordRequireNumber": define({
    key: "security.passwordRequireNumber",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Passwords need a number",
    input: "boolean",
  }),
  "security.passwordRequireSymbol": define({
    key: "security.passwordRequireSymbol",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Passwords need a symbol",
    input: "boolean",
  }),
  "security.passwordHistoryCount": define({
    key: "security.passwordHistoryCount",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(24),
    defaultValue: 0,
    label: "Block reuse of recent passwords",
    description: "How many previous passwords cannot be reused (0 = off)",
    unit: "passwords",
    input: "number",
  }),
  "security.maxFailedSignInAttempts": define({
    key: "security.maxFailedSignInAttempts",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(50),
    defaultValue: 5,
    label: "Failed sign-in attempts before lockout",
    input: "number",
  }),
  "security.lockoutMinutes": define({
    key: "security.lockoutMinutes",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(1440),
    defaultValue: 15,
    label: "Lockout duration",
    unit: "minutes",
    input: "number",
  }),
  "security.requireLoginOtp": define({
    key: "security.requireLoginOtp",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Require an emailed verification code after the password",
    description:
      "Two-step sign-in for every member. Members can also turn it on for themselves in their profile. Needs working email delivery",
    input: "boolean",
  }),
  "security.allowEmailCodeSignIn": define({
    key: "security.allowEmailCodeSignIn",
    group: "security",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: false,
    label: "Allow passwordless sign-in with an emailed code",
    description: "Needs working email delivery",
    input: "boolean",
  }),
  "security.authEmailCooldownSeconds": define({
    key: "security.authEmailCooldownSeconds",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(10).max(3600),
    defaultValue: 60,
    label: "Minimum wait between sign-in or reset emails",
    unit: "seconds",
    input: "number",
  }),
  "security.passwordResetExpiryMinutes": define({
    key: "security.passwordResetExpiryMinutes",
    group: "security",
    scope: "organization",
    schema: z.coerce.number().int().min(10).max(1440),
    defaultValue: 60,
    label: "Password reset links expire after",
    unit: "minutes",
    input: "number",
  }),

  // ─── Privacy ─────────────────────────────────────────────────────
  "privacy.auditLogRetentionDays": define({
    key: "privacy.auditLogRetentionDays",
    group: "privacy",
    scope: "organization",
    schema: z.coerce.number().int().min(30).max(3650),
    defaultValue: 365,
    label: "Audit log retention",
    unit: "days",
    input: "number",
  }),
  "privacy.notificationRetentionDays": define({
    key: "privacy.notificationRetentionDays",
    group: "privacy",
    scope: "organization",
    schema: z.coerce.number().int().min(7).max(730),
    defaultValue: 90,
    label: "Notification retention",
    unit: "days",
    input: "number",
  }),
  "privacy.dataExportExpiryHours": define({
    key: "privacy.dataExportExpiryHours",
    group: "privacy",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(168),
    defaultValue: 24,
    label: "Data export download link validity",
    unit: "hours",
    input: "number",
  }),
  "privacy.allowSelfDeletion": define({
    key: "privacy.allowSelfDeletion",
    group: "privacy",
    scope: "organization",
    schema: z.boolean(),
    defaultValue: true,
    label: "Members may delete their own account and data",
    input: "boolean",
  }),

  // ─── Documents ───────────────────────────────────────────────────
  "documents.maxAttachmentSizeMb": define({
    key: "documents.maxAttachmentSizeMb",
    group: "documents",
    scope: "organization",
    schema: z.coerce.number().min(1).max(100),
    defaultValue: 15,
    label: "Maximum attachment size",
    unit: "MB",
    input: "number",
  }),
  "documents.allowedMimeTypes": define({
    key: "documents.allowedMimeTypes",
    group: "documents",
    scope: "organization",
    schema: z.array(z.string().min(3)).min(1),
    defaultValue: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ],
    label: "Allowed attachment types",
    input: "string-list",
  }),
  "documents.appLogoMaxSizeKb": define({
    key: "documents.appLogoMaxSizeKb",
    group: "documents",
    scope: "organization",
    schema: z.coerce.number().int().min(16).max(1024),
    defaultValue: 512,
    label: "Maximum app icon size",
    description:
      "Uploaded app icons (PNG, JPEG, WebP or GIF) are stored with the attachment storage provider.",
    unit: "KB",
    input: "number",
  }),
  "documents.storageProvider": define({
    key: "documents.storageProvider",
    group: "documents",
    scope: "system",
    schema: z.enum(["local", "r2", "s3"]),
    defaultValue: "local",
    label: "Attachment storage provider",
    input: "select",
    options: STORAGE_PROVIDERS,
  }),

  // ─── Integrations ────────────────────────────────────────────────
  "integrations.mailboxScanIntervalHours": define({
    key: "integrations.mailboxScanIntervalHours",
    group: "integrations",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(168),
    defaultValue: 6,
    label: "Scan connected mailboxes every",
    unit: "hours",
    input: "number",
  }),
  "integrations.mailboxLookbackDays": define({
    key: "integrations.mailboxLookbackDays",
    group: "integrations",
    scope: "organization",
    schema: z.coerce.number().int().min(7).max(730),
    defaultValue: 90,
    label: "Initial mailbox scan looks back",
    unit: "days",
    input: "number",
  }),
  "integrations.receiptMinConfidence": define({
    key: "integrations.receiptMinConfidence",
    group: "integrations",
    scope: "organization",
    schema: z.coerce.number().min(0).max(1),
    defaultValue: 0.6,
    label: "Minimum confidence to show a receipt suggestion",
    input: "number",
    min: 0,
    max: 1,
  }),
  "integrations.mailboxMaxMessagesPerScan": define({
    key: "integrations.mailboxMaxMessagesPerScan",
    group: "integrations",
    scope: "organization",
    schema: z.coerce.number().int().min(10).max(1000),
    defaultValue: 100,
    label: "Maximum receipt-like messages fetched per mailbox scan",
    input: "number",
  }),
  "integrations.inactiveThresholdMinutes": define({
    key: "integrations.inactiveThresholdMinutes",
    group: "integrations",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(1440),
    defaultValue: 30,
    label: "Treat an app session as inactive after",
    unit: "minutes",
    input: "number",
  }),

  // ─── Discovery & analytics ───────────────────────────────────────
  "discovery.renewingSoonDays": define({
    key: "discovery.renewingSoonDays",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(365),
    defaultValue: 30,
    label: "“Renewing soon” window",
    unit: "days",
    input: "number",
  }),
  "discovery.pipelineWeekDays": define({
    key: "discovery.pipelineWeekDays",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(30),
    defaultValue: 7,
    label: "Pipeline “This week” bucket",
    unit: "days",
    input: "number",
  }),
  "discovery.pipelineMonthDays": define({
    key: "discovery.pipelineMonthDays",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(7).max(120),
    defaultValue: 30,
    label: "Pipeline “This month” bucket",
    unit: "days",
    input: "number",
  }),
  "discovery.costAnomalyThresholdPercent": define({
    key: "discovery.costAnomalyThresholdPercent",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().min(1).max(500),
    defaultValue: 50,
    label: "Cost anomaly threshold (month over month)",
    unit: "%",
    input: "number",
  }),
  "discovery.unusedSeatDays": define({
    key: "discovery.unusedSeatDays",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(7).max(365),
    defaultValue: 30,
    label: "Seat counts as unused after",
    unit: "days without login",
    input: "number",
  }),
  "discovery.topSpendCount": define({
    key: "discovery.topSpendCount",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(3).max(50),
    defaultValue: 10,
    label: "Items in “top spend” lists",
    input: "number",
  }),
  "discovery.searchResultLimit": define({
    key: "discovery.searchResultLimit",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(3).max(50),
    defaultValue: 8,
    label: "Global search results per group",
    input: "number",
  }),
  "discovery.searchMinChars": define({
    key: "discovery.searchMinChars",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(1).max(5),
    defaultValue: 2,
    label: "Minimum characters before global search runs",
    input: "number",
  }),
  "discovery.searchDebounceMs": define({
    key: "discovery.searchDebounceMs",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(50).max(2000),
    defaultValue: 250,
    label: "Global search debounce",
    unit: "ms",
    input: "number",
  }),
  "discovery.recentSearchesLimit": define({
    key: "discovery.recentSearchesLimit",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(20),
    defaultValue: 5,
    label: "Recent searches remembered in the command palette",
    input: "number",
  }),
  "discovery.listPageSize": define({
    key: "discovery.listPageSize",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(5).max(200),
    defaultValue: 20,
    label: "Default rows per page in subscription lists",
    input: "number",
  }),
  "discovery.listPageSizeOptions": define({
    key: "discovery.listPageSizeOptions",
    group: "discovery",
    scope: "organization",
    schema: z.array(z.coerce.number().int().min(5).max(500)).min(1),
    defaultValue: [10, 20, 50, 100],
    label: "Rows-per-page choices in subscription lists",
    input: "number-list",
  }),
  "discovery.pipelineOverdueGraceDays": define({
    key: "discovery.pipelineOverdueGraceDays",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(0).max(30),
    defaultValue: 0,
    label: "Days after a renewal date before it counts as overdue",
    unit: "days",
    input: "number",
  }),
  "discovery.exportMaxRows": define({
    key: "discovery.exportMaxRows",
    group: "discovery",
    scope: "organization",
    schema: z.coerce.number().int().min(100).max(100000),
    defaultValue: 10000,
    label: "Maximum rows in a CSV export",
    input: "number",
  }),

  // ─── System (SUPER_ADMIN) ────────────────────────────────────────
  "system.allowSelfSignup": define({
    key: "system.allowSelfSignup",
    group: "system",
    scope: "system",
    schema: z.boolean(),
    defaultValue: true,
    label: "Allow public sign-up",
    description:
      "SaaS: new customers sign up and create their own organisation; users join an organisation by invitation or by its claimed email domain. Single-tenant: after first-run setup, users whose email domain belongs to the organisation join it automatically; everyone else needs an invitation.",
    input: "boolean",
  }),
  "system.supportEmail": define({
    key: "system.supportEmail",
    group: "system",
    scope: "system",
    schema: z.string().email().or(z.literal("")),
    defaultValue: "",
    label: "Support email shown in the app",
    input: "text",
  }),
  "system.maintenanceMode": define({
    key: "system.maintenanceMode",
    group: "system",
    scope: "system",
    schema: z.boolean(),
    defaultValue: false,
    label: "Maintenance mode (read-only banner)",
    input: "boolean",
  }),
  "system.defaultFxProvider": define({
    key: "system.defaultFxProvider",
    group: "system",
    scope: "system",
    schema: z.enum([
      "manual",
      "frankfurter",
      "open_er_api",
      "exchangerate_host",
      "google_finance",
    ]),
    defaultValue: "open_er_api",
    label: "Default exchange-rate provider for new organisations",
    input: "select",
    options: FX_PROVIDERS,
  }),
  "system.catalogAutoUpdate": define({
    key: "system.catalogAutoUpdate",
    group: "system",
    scope: "system",
    schema: z.boolean(),
    defaultValue: true,
    label: "Refresh vendor catalog metadata automatically",
    input: "boolean",
  }),
  "system.platformAuditPageSize": define({
    key: "system.platformAuditPageSize",
    group: "system",
    scope: "system",
    schema: z.coerce.number().int().min(10).max(200),
    defaultValue: 25,
    label: "Control Panel audit log: entries per page",
    input: "number",
    min: 10,
    max: 200,
  }),
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export type SettingValue<K extends SettingKey> = z.infer<
  (typeof SETTING_DEFINITIONS)[K]["schema"]
>;
export type ResolvedSettings = { [K in SettingKey]: SettingValue<K> };

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

export function getSettingDefinition<K extends SettingKey>(key: K) {
  return SETTING_DEFINITIONS[key];
}

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_DEFINITIONS;
}

export function listSettingsByGroup(
  group: SettingGroupKey
): SettingDefinition[] {
  return SETTING_KEYS.filter((k) => SETTING_DEFINITIONS[k].group === group).map(
    (k) => SETTING_DEFINITIONS[k] as SettingDefinition
  );
}

export function getDefaultSettings(): ResolvedSettings {
  const out: Record<string, unknown> = {};
  for (const key of SETTING_KEYS) {
    out[key] = SETTING_DEFINITIONS[key].defaultValue;
  }
  return out as ResolvedSettings;
}
