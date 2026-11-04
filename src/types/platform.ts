// src/types/platform.ts
/**
 * Serialisable shapes shared between platform server actions and client
 * components (settings UI, masters admin, roles, privacy, templates).
 */
import type {
  SettingGroupKey,
  SettingInput,
  SettingOption,
  SettingScope,
} from "@/lib/settings/registry";
import type {
  BillingCycle,
  DataExportStatus,
  NotificationChannel,
  NotificationEventType,
  PaymentMethodKind,
} from "@prisma/client";

/** Value the client sends back for an untouched secret. */
export const SECRET_UNCHANGED = "__unchanged__";

export interface SerializedSettingDefinition {
  key: string;
  group: SettingGroupKey;
  scope: SettingScope;
  label: string;
  description?: string;
  input: SettingInput;
  options?: SettingOption[];
  unit?: string;
  min?: number;
  max?: number;
  sensitive?: boolean;
  defaultValue: unknown;
  value: unknown;
  /** True when the organisation (or system) has an explicit override */
  isOverridden: boolean;
}

export interface SettingsGroupPayload {
  group: SettingGroupKey;
  label: string;
  description: string;
  definitions: SerializedSettingDefinition[];
}

export interface SettingsGroupMeta {
  key: SettingGroupKey;
  label: string;
  description: string;
}

// ─── Masters ──────────────────────────────────────────────────────
export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
  isEnabled: boolean;
  isBase: boolean;
  /** Latest rate: 1 base currency = `rate` of this currency */
  rate: number | null;
  rateAsOf: string | null;
  rateSource: string | null;
  stale: boolean;
}

export interface TaxRateRow {
  id: string;
  name: string;
  countryCode: string | null;
  ratePercent: number;
  isDefault: boolean;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
}

export interface CostCenterRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  teamId: string | null;
  teamName: string | null;
  budgetMonthly: number | null;
  budgetCurrency: string | null;
  isActive: boolean;
}

export interface PaymentMethodRow {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  corporateCardId: string | null;
  corporateCardLabel: string | null;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface BillingCycleRow {
  id: string;
  cycle: BillingCycle;
  label: string;
  months: number;
  isEnabled: boolean;
  sortOrder: number;
}

export interface MasterOption {
  id: string;
  label: string;
}

// ─── Roles ────────────────────────────────────────────────────────
export interface RoleRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  legacyRole: string | null;
  memberCount: number;
  permissionKeys: string[];
}

export interface MemberRoleRow {
  id: string;
  name: string | null;
  email: string;
  systemRole: string;
  customRoleId: string | null;
  status: string;
}

export interface PermissionGroupRow {
  group: string;
  permissions: { key: string; description: string }[];
}

// ─── Privacy ──────────────────────────────────────────────────────
export interface DataExportRow {
  id: string;
  status: DataExportStatus;
  format: string;
  sizeBytes: number | null;
  requestedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  errorMessage: string | null;
}

// ─── Notification templates ───────────────────────────────────────
export interface NotificationTemplateRow {
  id: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  locale: string;
  subject: string;
  body: string;
  isActive: boolean;
  /** "custom" when an organisation override row exists */
  source: "custom" | "default";
  placeholders: string[];
}

export interface MeContext {
  baseCurrency: string;
  enabledCurrencies: string[];
  locale: string;
  timezone: string;
  dateFormat: string;
  roundingDecimals: number;
}
