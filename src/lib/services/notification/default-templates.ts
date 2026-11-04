// src/lib/services/notification/default-templates.ts
/**
 * English defaults for every NotificationEventType × channel. Organisations
 * override them in `/settings/notification-templates` (NotificationTemplate rows).
 * Placeholders use `{{name}}`; see TEMPLATE_PLACEHOLDERS for what each event supplies.
 */
import type {
  NotificationChannel,
  NotificationEventType,
} from "@prisma/client";

export interface TemplateContent {
  subject?: string;
  body: string;
}

export type ChannelTemplates = Record<NotificationChannel, TemplateContent>;

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = [
  "IN_APP",
  "EMAIL",
  "PUSH",
];

export const DEFAULT_TEMPLATE_LOCALE = "en";

/** Variables common to every event. */
export const COMMON_PLACEHOLDERS = [
  "recipientName",
  "organizationName",
  "productName",
  "link",
] as const;

/** Event-specific variables available to template authors. */
export const TEMPLATE_PLACEHOLDERS: Record<
  NotificationEventType,
  readonly string[]
> = {
  RENEWAL_REMINDER: [
    "serviceName",
    "amount",
    "currency",
    "renewalDate",
    "daysUntil",
    "billingCycle",
    "ownerName",
  ],
  TRIAL_ENDING: [
    "serviceName",
    "trialEndDate",
    "daysUntil",
    "amount",
    "currency",
  ],
  PRICE_CHANGE: [
    "serviceName",
    "previousAmount",
    "newAmount",
    "currency",
    "changePercent",
  ],
  NOTICE_PERIOD: ["serviceName", "noticeDeadline", "daysUntil", "renewalDate"],
  APPROVAL_REQUESTED: [
    "requesterName",
    "serviceName",
    "amount",
    "currency",
    "billingCycle",
    "justification",
  ],
  APPROVAL_DECIDED: ["approverName", "serviceName", "decision", "comment"],
  APPROVAL_INFO_REQUESTED: ["approverName", "serviceName", "question"],
  APPROVAL_ESCALATED: [
    "requesterName",
    "serviceName",
    "amount",
    "currency",
    "pendingDays",
  ],
  APPROVER_RENEWAL: [
    "serviceName",
    "amount",
    "currency",
    "renewalDate",
    "ownerName",
  ],
  OFFBOARDING: ["memberName", "seatCount", "serviceNames"],
  SHADOW_IT: ["serviceName", "detectedBy", "userCount"],
  COST_ANOMALY: [
    "serviceName",
    "previousAmount",
    "newAmount",
    "currency",
    "changePercent",
  ],
  PENDING_REVIEW: ["itemCount", "sourceName"],
  RECEIPT_SUGGESTION: [
    "vendorName",
    "amount",
    "currency",
    "chargeDate",
    "confidence",
  ],
  DIGEST: [
    "periodLabel",
    "renewalCount",
    "approvalCount",
    "totalMonthly",
    "currency",
  ],
  SYSTEM: ["title", "message"],
};

function trio(
  subject: string,
  body: string,
  push: string = body
): ChannelTemplates {
  return {
    IN_APP: { subject, body },
    EMAIL: { subject: `[{{productName}}] ${subject}`, body },
    PUSH: { subject, body: push },
  };
}

export const DEFAULT_TEMPLATES: Record<
  NotificationEventType,
  ChannelTemplates
> = {
  RENEWAL_REMINDER: trio(
    "{{serviceName}} renews in {{daysUntil}} days",
    "Hi {{recipientName}}, {{serviceName}} renews on {{renewalDate}} for {{amount}} {{currency}} ({{billingCycle}}). Review it here: {{link}}",
    "{{serviceName}} renews on {{renewalDate}} for {{amount}} {{currency}}."
  ),
  TRIAL_ENDING: trio(
    "{{serviceName}} trial ends in {{daysUntil}} days",
    "Hi {{recipientName}}, the {{serviceName}} trial ends on {{trialEndDate}}. Decide whether to keep it before you are charged {{amount}} {{currency}}: {{link}}",
    "{{serviceName}} trial ends on {{trialEndDate}}."
  ),
  PRICE_CHANGE: trio(
    "Price change detected for {{serviceName}}",
    "Hi {{recipientName}}, {{serviceName}} moved from {{previousAmount}} to {{newAmount}} {{currency}} ({{changePercent}}%). Confirm or dispute the change: {{link}}",
    "{{serviceName}}: {{previousAmount}} → {{newAmount}} {{currency}} ({{changePercent}}%)."
  ),
  NOTICE_PERIOD: trio(
    "Cancellation notice for {{serviceName}} is due in {{daysUntil}} days",
    "Hi {{recipientName}}, to avoid the renewal on {{renewalDate}} you must give notice for {{serviceName}} by {{noticeDeadline}}. Details: {{link}}",
    "Notice deadline for {{serviceName}}: {{noticeDeadline}}."
  ),
  APPROVAL_REQUESTED: trio(
    "{{requesterName}} requests approval for {{serviceName}}",
    "Hi {{recipientName}}, {{requesterName}} is requesting {{serviceName}} at {{amount}} {{currency}} ({{billingCycle}}). Reason: {{justification}}. Review the request: {{link}}",
    "{{requesterName}} requests {{serviceName}} ({{amount}} {{currency}})."
  ),
  APPROVAL_DECIDED: trio(
    "Your request for {{serviceName}} was {{decision}}",
    "Hi {{recipientName}}, {{approverName}} {{decision}} your request for {{serviceName}}. {{comment}} See the outcome: {{link}}",
    "{{serviceName}} request {{decision}} by {{approverName}}."
  ),
  APPROVAL_INFO_REQUESTED: trio(
    "{{approverName}} needs more information about {{serviceName}}",
    'Hi {{recipientName}}, {{approverName}} asked: "{{question}}" regarding your {{serviceName}} request. Reply here: {{link}}',
    "{{approverName}} needs more information on {{serviceName}}."
  ),
  APPROVAL_ESCALATED: trio(
    "Escalated: {{serviceName}} request pending for {{pendingDays}} days",
    "Hi {{recipientName}}, the {{serviceName}} request from {{requesterName}} ({{amount}} {{currency}}) has waited {{pendingDays}} days and was escalated to you. Decide now: {{link}}",
    "Escalated approval: {{serviceName}} ({{amount}} {{currency}})."
  ),
  APPROVER_RENEWAL: trio(
    "Renewal you approved: {{serviceName}} on {{renewalDate}}",
    "Hi {{recipientName}}, {{serviceName}} (owner {{ownerName}}) renews on {{renewalDate}} for {{amount}} {{currency}}. Confirm it is still needed: {{link}}",
    "{{serviceName}} renews {{renewalDate}} — {{amount}} {{currency}}."
  ),
  OFFBOARDING: trio(
    "{{memberName}} left — {{seatCount}} seats to reclaim",
    "Hi {{recipientName}}, {{memberName}} has been offboarded and still holds {{seatCount}} seats across {{serviceNames}}. Reassign or remove them: {{link}}",
    "{{memberName}} offboarded: {{seatCount}} seats to reclaim."
  ),
  SHADOW_IT: trio(
    "New unmanaged app detected: {{serviceName}}",
    "Hi {{recipientName}}, {{serviceName}} was detected via {{detectedBy}} and is used by {{userCount}} members but is not tracked. Review it: {{link}}",
    "Unmanaged app detected: {{serviceName}} ({{userCount}} users)."
  ),
  COST_ANOMALY: trio(
    "Spend anomaly on {{serviceName}}",
    "Hi {{recipientName}}, spend on {{serviceName}} changed from {{previousAmount}} to {{newAmount}} {{currency}} ({{changePercent}}%). Investigate: {{link}}",
    "{{serviceName}} spend changed {{changePercent}}%."
  ),
  PENDING_REVIEW: trio(
    "{{itemCount}} items awaiting your review",
    "Hi {{recipientName}}, {{itemCount}} detected items from {{sourceName}} are waiting for confirmation. Review them: {{link}}",
    "{{itemCount}} items awaiting review."
  ),
  RECEIPT_SUGGESTION: trio(
    "Possible subscription charge: {{vendorName}}",
    "Hi {{recipientName}}, we found a charge of {{amount}} {{currency}} from {{vendorName}} on {{chargeDate}} (confidence {{confidence}}%). Add it as a subscription: {{link}}",
    "{{vendorName}}: {{amount}} {{currency}} on {{chargeDate}}."
  ),
  DIGEST: trio(
    "Your {{periodLabel}} subscription digest",
    "Hi {{recipientName}}, this {{periodLabel}}: {{renewalCount}} renewals, {{approvalCount}} approvals pending, total monthly spend {{totalMonthly}} {{currency}}. Open the dashboard: {{link}}",
    "{{periodLabel}} digest: {{renewalCount}} renewals, {{approvalCount}} approvals."
  ),
  SYSTEM: trio("{{title}}", "{{message}} {{link}}", "{{message}}"),
};

export function getDefaultTemplate(
  eventType: NotificationEventType,
  channel: NotificationChannel
): TemplateContent {
  return DEFAULT_TEMPLATES[eventType][channel];
}
