// src/lib/audit/describe-action.ts
/**
 * Turns audit-log action codes (CREATE_SAVED_VIEW, APPROVAL_REQUEST_SUBMITTED…)
 * into short English sentences for activity feeds, audit tables and filters.
 * Explicit phrases cover codes that read awkwardly when generated; every other
 * code is phrased from its verb + object, so new codes never show raw.
 */

const PHRASES: Record<string, string> = {
  CREATE: "Created a record",
  UPDATE: "Updated a record",
  DELETE: "Deleted a record",
  EXPORT: "Exported data",
  LOGIN: "Signed in",
  LOGOUT: "Signed out",
  CREATE_APP: "Added an app",
  CREATE_SUBSCRIPTION: "Registered a subscription",
  ADD_SUBSCRIPTION_COMMENT: "Commented on a subscription",
  APPROVAL_REQUEST_SUBMITTED: "Submitted an approval request",
  APPROVAL_REQUEST_APPROVED: "Approved an approval request",
  APPROVAL_REQUEST_REJECTED: "Rejected an approval request",
  APPROVAL_REQUEST_CANCELLED: "Cancelled an approval request",
  APPROVAL_REQUEST_SUBSCRIPTION_CREATED:
    "Created a subscription from an approved request",
  ACCEPT_RECEIPT_SUGGESTION: "Accepted a receipt suggestion",
  DISMISS_RECEIPT_SUGGESTION: "Dismissed a receipt suggestion",
  LINK_RECEIPT_SUGGESTION: "Linked a receipt to a subscription",
  ACKNOWLEDGE_PRICE_CHANGE: "Acknowledged a price change",
  DETECT_PRICE_CHANGE: "Detected a price change",
  ASSIGN_APP_TEAM: "Assigned an app to a team",
  ASSIGN_ROLE: "Changed a member's role",
  BULK_IMPORT_USERS: "Imported members in bulk",
  BULK_UPDATE_SUBSCRIPTIONS: "Updated subscriptions in bulk",
  CONNECT_MAILBOX: "Connected a mailbox",
  DISCONNECT_MAILBOX: "Disconnected a mailbox",
  SCAN_MAILBOX: "Scanned a mailbox for receipts",
  EXTENSION_ONBOARDING_COMPLETED: "Completed browser-extension setup",
  LINK_CARD_TRANSACTIONS: "Linked card transactions",
  LINK_PAYMENT_RECORDS: "Linked payment records",
  SYNC_CARD_TRANSACTIONS: "Synced card transactions",
  MERGE_TAGS: "Merged tags",
  OFFBOARD_USER: "Offboarded a member",
  USER_TERMINATED: "Offboarded a member",
  PERMANENTLY_DELETE_USER: "Permanently deleted a member",
  REFRESH_EXCHANGE_RATES: "Refreshed exchange rates",
  SET_MANUAL_RATE: "Set a manual exchange rate",
  REQUEST_DATA_EXPORT: "Requested a data export",
  RESET_NOTIFICATION_TEMPLATE: "Reset a notification template",
  RESET_ROLE_TEMPLATE: "Reset a role to its defaults",
  RESET_SETTING: "Reset a setting to its default",
  REVOKE_ACCESS: "Revoked app access",
  REVOKE_APP_ACCESS: "Revoked app access",
  GRANT_APP_ACCESS: "Granted app access",
  REVOKE_ALL_ACCESS: "Revoked all app access for a member",
  SET_APP_CANCELLATION_OVERRIDE: "Updated an app's cancellation guide",
  SET_DEFAULT_SAVED_VIEW: "Set a default saved view",
  TRANSFER_ADMIN: "Transferred the administrator role",
  TRIAL_CONVERTED: "Converted a trial to paid",
  UPDATE_SETTINGS: "Updated workspace settings",
  UPDATE_TEAM_APPROVER: "Changed a team's approver",
  UPDATE_NOTIFICATION_DEFAULTS: "Updated notification defaults",
  UPDATE_NOTIFICATION_PREFERENCES: "Updated notification preferences",
  UPDATE_USER: "Updated a member",
  UPLOAD_ATTACHMENT: "Uploaded an attachment",
  DELETE_ATTACHMENT: "Deleted an attachment",
};

/** Past-tense verbs for the leading token of `VERB_OBJECT` codes. */
const VERBS: Record<string, string> = {
  CREATE: "Created",
  ADD: "Added",
  UPDATE: "Updated",
  EDIT: "Edited",
  DELETE: "Deleted",
  REMOVE: "Removed",
  ARCHIVE: "Archived",
  RESTORE: "Restored",
  PAUSE: "Paused",
  RESUME: "Resumed",
  CANCEL: "Cancelled",
  RENAME: "Renamed",
  REORDER: "Reordered",
  EXPORT: "Exported",
  IMPORT: "Imported",
  SYNC: "Synced",
  LINK: "Linked",
  UNLINK: "Unlinked",
  ASSIGN: "Assigned",
  UNASSIGN: "Unassigned",
  APPROVE: "Approved",
  REJECT: "Rejected",
  SUBMIT: "Submitted",
  INVITE: "Invited",
  ACCEPT: "Accepted",
  DISMISS: "Dismissed",
  CONNECT: "Connected",
  DISCONNECT: "Disconnected",
  ENABLE: "Enabled",
  DISABLE: "Disabled",
  SET: "Set",
  RESET: "Reset",
  MERGE: "Merged",
  REVOKE: "Revoked",
  GRANT: "Granted",
  UPLOAD: "Uploaded",
  SCAN: "Scanned",
  REFRESH: "Refreshed",
};

/** Objects whose plural/compound reading needs no article. */
const NO_ARTICLE = /(s|data|settings|preferences|access|defaults)$/;

/** Words kept in their usual casing inside generated sentences. */
const ACRONYMS: Record<string, string> = {
  fx: "FX",
  csv: "CSV",
  sso: "SSO",
  api: "API",
};

function words(tokens: string[]): string {
  return tokens
    .map((t) => t.toLowerCase())
    .map((t) => ACRONYMS[t] ?? t)
    .join(" ");
}

function withArticle(object: string): string {
  if (NO_ARTICLE.test(object)) return object;
  return /^[aeiou]/.test(object) ? `an ${object}` : `a ${object}`;
}

function sentenceCase(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Human-readable sentence for an audit-log action code. */
export function describeAuditAction(action: string): string {
  const code = action.trim().toUpperCase();
  if (!code) return "";
  if (PHRASES[code]) return PHRASES[code];
  const tokens = code.split(/[_\s.:-]+/).filter(Boolean);
  const [head, ...rest] = tokens;
  if (head && VERBS[head]) {
    return rest.length
      ? `${VERBS[head]} ${withArticle(words(rest))}`
      : VERBS[head];
  }
  // OBJECT_PAST_PARTICIPLE (e.g. INVOICE_PAID) or anything else.
  return sentenceCase(words(tokens));
}
