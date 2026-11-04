// src/types/notification.ts
/**
 * Shared DTOs for the unified notification centre (web + mobile clients).
 */
import type {
  DevicePlatformType,
  NotificationChannel,
  NotificationEventType,
} from "@prisma/client";

/** UI grouping of event types for filters and icons. */
export type NotificationTypeGroup =
  | "renewals"
  | "approvals"
  | "priceChanges"
  | "security"
  | "other";

export const NOTIFICATION_TYPE_GROUPS: Record<
  NotificationTypeGroup,
  NotificationEventType[]
> = {
  renewals: [
    "RENEWAL_REMINDER",
    "TRIAL_ENDING",
    "NOTICE_PERIOD",
    "APPROVER_RENEWAL",
  ],
  approvals: [
    "APPROVAL_REQUESTED",
    "APPROVAL_DECIDED",
    "APPROVAL_INFO_REQUESTED",
    "APPROVAL_ESCALATED",
  ],
  priceChanges: ["PRICE_CHANGE", "COST_ANOMALY", "RECEIPT_SUGGESTION"],
  security: ["OFFBOARDING", "SHADOW_IT", "PENDING_REVIEW"],
  other: ["DIGEST", "SYSTEM"],
};

export const ALL_NOTIFICATION_EVENT_TYPES: NotificationEventType[] =
  Object.values(NOTIFICATION_TYPE_GROUPS).flat();

export function groupOfType(
  type: NotificationEventType
): NotificationTypeGroup {
  for (const [group, types] of Object.entries(NOTIFICATION_TYPE_GROUPS)) {
    if (types.includes(type)) return group as NotificationTypeGroup;
  }
  return "other";
}

/** Serialisable notification row for clients. */
export interface NotificationItem {
  id: string;
  type: NotificationEventType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface NotificationListPage {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}

export interface NotificationListParams {
  cursor?: string | null;
  limit?: number;
  unreadOnly?: boolean;
  types?: NotificationEventType[];
}

/** One cell of the preference grid. Absence of a row means enabled. */
export interface NotificationPreferenceCell {
  eventType: NotificationEventType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationPreferenceMatrix {
  /** Channels the organisation makes available (`notifications.enabledChannels`). */
  channels: NotificationChannel[];
  cells: NotificationPreferenceCell[];
  /** Personal default reminder lead days (User.preferences.reminderLeadDays). */
  reminderLeadDays: number[];
  /** Options offered by the organisation (`subscriptions.reminderLeadDayOptions`). */
  reminderLeadDayOptions: number[];
  /** Organisation default used when the user has not chosen (`subscriptions.defaultReminderLeadDays`). */
  organizationDefaultLeadDays: number[];
}

export interface DeviceTokenItem {
  id: string;
  platform: DevicePlatformType;
  deviceName: string | null;
  lastSeenAt: string;
}

/** Onboarding checklist step keys (auto-detected). */
export type OnboardingStepKey =
  | "firstSubscription"
  | "reminderLeadDays"
  | "inviteTeammate"
  | "approvalPolicy"
  | "connectIntegration"
  | "baseCurrency";

export const ONBOARDING_STEP_KEYS: OnboardingStepKey[] = [
  "firstSubscription",
  "reminderLeadDays",
  "inviteTeammate",
  "approvalPolicy",
  "connectIntegration",
  "baseCurrency",
];

export interface OnboardingStep {
  key: OnboardingStepKey;
  done: boolean;
  href: string;
}

export interface OnboardingProgressView {
  steps: OnboardingStep[];
  completed: number;
  total: number;
  percent: number;
  dismissed: boolean;
}
