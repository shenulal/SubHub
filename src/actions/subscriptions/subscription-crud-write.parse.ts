// src/actions/subscriptions/subscription-crud-write.parse.ts
/**
 * FormData → raw object parsing for the subscription create/update actions.
 * Pure: no I/O. Accepts both HTML form posts and JSON→FormData from the REST API.
 */

import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";

const TRUE_VALUES = new Set(["true", "on", "1"]);

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function bool(formData: FormData, key: string, fallback: boolean): boolean {
  const value = text(formData, key);
  if (value == null) return fallback;
  return TRUE_VALUES.has(value.toLowerCase());
}

function list(formData: FormData, key: string): string[] {
  const values = formData.getAll(key);
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    // Allow comma-separated single values (e.g. "7,3,1") as well as repeats.
    out.push(
      ...value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    );
  }
  return out;
}

/**
 * Custom fields arrive either as a JSON object under `customFields`
 * or as individual `customFields[<key>]` entries.
 */
export function parseCustomFields(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  const json = text(formData, "customFields");
  if (json) {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed)) {
          if (value != null) result[key] = String(value);
        }
      }
    } catch {
      // Malformed JSON is ignored; the bracket form below may still apply.
    }
  }
  formData.forEach((value, key) => {
    const match = /^customFields\[(.+)\]$/.exec(key);
    if (match && typeof value === "string") result[match[1]] = value;
  });
  return result;
}

function numberOrNull(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value == null || value === "" ? null : value;
}

export interface ParsedSubscriptionForm {
  appId: string | null;
  appName: string | null;
  catalogId: string | null;
  appWebsite: string | null;
  appLogoUrl: string | null;
  status: string | null;
  billingCycle: string | null;
  billingType: string | null;
  amount: string | null;
  perSeatPrice: string | null;
  currency: string | null;
  totalLicenses: string | null;
  usedLicenses: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  autoRenewal: boolean;
  renewalAlert30: boolean;
  renewalAlert60: boolean;
  renewalAlert90: boolean;
  contractUrl: string | null;
  notes: string | null;
  teamId: string | null;
  teamIds: string[];
  assignedUserIds: string[];
  categoryId: string | null;
  paymentMethodId: string | null;
  costCenterId: string | null;
  taxRateId: string | null;
  isTrial: boolean;
  trialEndsAt: string | null;
  noticePeriodDays: string | null;
  reminderLeadDays: string[] | undefined;
  isPersonal: boolean;
  ownerId: string | null;
  tagNames: string[];
  customFields: Record<string, string>;
  cancellationUrl: string | null;
  cancellationNotes: string | null;
}

export function parseSubscriptionFormData(
  formData: FormData,
  defaults: {
    billingType?: string | null;
    currency?: string | null;
    status?: string | null;
  } = {}
): ParsedSubscriptionForm {
  const leadDays = list(formData, "reminderLeadDays");
  return {
    appId: text(formData, "appId") || null,
    appName: text(formData, "appName") || null,
    catalogId: text(formData, "catalogId") || null,
    appWebsite: text(formData, "appWebsite") || null,
    appLogoUrl: text(formData, "appLogoUrl") || null,
    status: text(formData, "status") || defaults.status || null,
    billingCycle: text(formData, "billingCycle"),
    billingType:
      text(formData, "billingType") || defaults.billingType || "FLAT_RATE",
    amount: text(formData, "amount"),
    perSeatPrice: numberOrNull(formData, "perSeatPrice"),
    currency:
      text(formData, "currency") || defaults.currency || DEFAULT_BASE_CURRENCY,
    totalLicenses: numberOrNull(formData, "totalLicenses"),
    usedLicenses: numberOrNull(formData, "usedLicenses"),
    startDate: text(formData, "startDate"),
    endDate: text(formData, "endDate"),
    renewalDate: text(formData, "renewalDate"),
    autoRenewal: bool(formData, "autoRenewal", false),
    renewalAlert30: bool(formData, "renewalAlert30", false),
    renewalAlert60: bool(formData, "renewalAlert60", false),
    renewalAlert90: bool(formData, "renewalAlert90", false),
    contractUrl: text(formData, "contractUrl"),
    notes: text(formData, "notes"),
    teamId: text(formData, "teamId") || null,
    teamIds: list(formData, "teamIds"),
    assignedUserIds: list(formData, "assignedUserIds"),
    categoryId: text(formData, "categoryId") || null,
    paymentMethodId: text(formData, "paymentMethodId") || null,
    costCenterId: text(formData, "costCenterId") || null,
    taxRateId: text(formData, "taxRateId") || null,
    isTrial: bool(formData, "isTrial", false),
    trialEndsAt: text(formData, "trialEndsAt"),
    noticePeriodDays: numberOrNull(formData, "noticePeriodDays"),
    reminderLeadDays: formData.has("reminderLeadDays") ? leadDays : undefined,
    isPersonal: bool(formData, "isPersonal", false),
    ownerId: text(formData, "ownerId") || null,
    tagNames: list(formData, "tagNames"),
    customFields: parseCustomFields(formData),
    cancellationUrl: text(formData, "cancellationUrl"),
    cancellationNotes: text(formData, "cancellationNotes"),
  };
}

/** `""` → null for optional id/date strings coming from forms. */
export function blankToNull(value: string | null | undefined): string | null {
  return value ? value : null;
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
