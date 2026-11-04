// src/lib/services/notification/index.ts
export {
  EmailConfig,
  sendRenewalAlertEmail,
  sendTerminatedUserAlertEmail,
  sendWelcomeEmail,
  type EmailResult,
  type RenewalAlertEmailParams,
  type TerminatedUserAlertParams,
  type WelcomeEmailParams,
} from "./email";

export {
  findUpcomingRenewals,
  processRenewalAlerts,
  sendRenewalAlert,
  type ProcessResult,
  type SendAlertResult,
  type UpcomingRenewal,
} from "./renewalAlert";

export {
  sendCostAnomalyAlertEmail,
  sendShadowITAlertEmail,
  type CostAnomalyAlertParams,
  type ShadowITAlertParams,
} from "./securityAlert";

export {
  sendAgentInstallationReminderEmail,
  type AgentInstallationReminderParams,
} from "./agentReminder";

export { backfillComputedAlerts } from "./backfill";
export {
  getOrganizationAdminIds,
  notify,
  type NotifyEmailContent,
  type NotifyInput,
  type NotifyResult,
} from "./center";
export { processDeferredNotifications } from "./deferred";
export {
  processSubscriptionReminders,
  type ReminderRunOptions,
  type ReminderRunResult,
} from "./reminders";
export { processWeeklyDigest } from "./weeklyDigest";
