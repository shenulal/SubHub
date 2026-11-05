// src/lib/services/notification/email.ts
/**
 * Unified e-mail service module
 *
 * Re-exports all e-mail functions to keep existing imports working:
 * - email.types.ts: type definitions
 * - email.utils.ts: utilities + configuration
 * - email-alerts.ts: renewal / offboarded-user alerts
 * - email-notifications.ts: confirmation / weekly summary notifications
 * - email-onboarding.ts: welcome / invitation e-mails
 */

// Types re-export
export type {
  ConfirmationResultEmailParams,
  EmailResult,
  InvitationEmailParams,
  RenewalAlertEmailParams,
  TerminatedUserAlertParams,
  WeeklyDigestEmailParams,
  WelcomeEmailParams,
} from "./email.types";

// Utils re-export
export {
  EmailConfig,
  formatCurrency,
  formatDate,
  getBaseUrl,
  getResendClient,
} from "./email.utils";

// Alert emails re-export
export {
  sendRenewalAlertEmail,
  sendTerminatedUserAlertEmail,
} from "./email-alerts";

// Notification emails re-export
export {
  sendConfirmationResultEmail,
  sendWeeklyDigestEmail,
} from "./email-notifications";

// Onboarding emails re-export
export { sendInvitationEmail, sendWelcomeEmail } from "./email-onboarding";
