// src/lib/services/notification/email.types.ts

/**
 * E-mail send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Renewal alert e-mail parameters
 */
export interface RenewalAlertEmailParams {
  to: string;
  appName: string;
  renewalDate: Date;
  daysUntilRenewal: number;
  amount: number;
  currency: string;
  organizationName: string;
}

/**
 * Welcome e-mail parameters
 */
export interface WelcomeEmailParams {
  to: string;
  userName: string;
  organizationName: string;
}

/**
 * Offboarded-user alert e-mail parameters
 */
export interface TerminatedUserAlertParams {
  to: string;
  /** When set, an in-app notification is mirrored for the recipient. */
  organizationId?: string;
  recipientUserId?: string;
  terminatedUserName: string;
  terminatedUserEmail: string;
  unrevokedApps: string[];
  terminatedAt: Date;
  organizationName: string;
}

/**
 * Extension onboarding e-mail parameters
 */
export interface ExtensionOnboardingGuideEmailParams {
  to: string;
  userName: string;
  orgName: string;
}

/**
 * Invitation e-mail parameters
 */
export interface InvitationEmailParams {
  email: string;
  token: string;
  organizationName?: string;
  inviterName?: string;
  role?: string;
}

/**
 * LLM confirmation result notification parameters
 */
export interface ConfirmationResultEmailParams {
  to: string;
  organizationName: string;
  appName: string;
  action: "approved" | "rejected";
  confidence?: number | null;
  normalizedName?: string | null;
}

/**
 * Weekly summary e-mail parameters
 */
export interface WeeklyDigestEmailParams {
  to: string;
  organizationName: string;
  weekRange: string;
  stats: {
    newApps: number;
    unmatchedPayments: number;
    upcomingRenewals: number;
    pendingConfirmations: number;
  };
}
