// src/lib/services/notification/reminders-email.ts
/**
 * Copy for renewal reminders (in-app title/body + email HTML).
 * Organisation templates (when present) take precedence inside `notify()`.
 */
import { formatMoneyForNotification } from "./adapters/money";
import type { NotifyEmailContent } from "./center-email";
import { getBaseUrl } from "./email.utils";

export interface RenewalReminderCopyInput {
  appName: string;
  billingCycle: string;
  ownerName: string | null;
  subscriptionId: string;
  renewalDateKey: string; // YYYY-MM-DD in org time zone
  leadDays: number;
  amount: number;
  currency: string;
  organizationName: string;
  /** Whether the recipient is receiving this as an approver copy. */
  forApprover: boolean;
}

export interface RenewalReminderCopy {
  title: string;
  body: string;
  link: string;
  email: NotifyEmailContent;
  templateVars: Record<string, string | number | null>;
}

export function subscriptionDetailPath(subscriptionId: string): string {
  return `/subscriptions/${subscriptionId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildRenewalReminderCopy(
  input: RenewalReminderCopyInput
): RenewalReminderCopy {
  const money = formatMoneyForNotification(input.amount, input.currency);
  const link = subscriptionDetailPath(input.subscriptionId);
  const url = `${getBaseUrl()}${link}`;
  const when =
    input.leadDays === 0
      ? "today"
      : input.leadDays === 1
        ? "tomorrow"
        : `in ${input.leadDays} days`;
  const audience = input.forApprover ? "You approved this subscription. " : "";
  const title = `${input.appName} renews ${when} (${money})`;
  const body = `${audience}${input.appName} renews on ${input.renewalDateKey} for ${money}.`;
  const safeApp = escapeHtml(input.appName);
  const safeOrg = escapeHtml(input.organizationName);

  const html = `<!DOCTYPE html><html lang="en"><body style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:24px;">
  <div style="background:linear-gradient(135deg,#0f766e,#115e59);color:#fff;padding:24px;border-radius:12px 12px 0 0;">
    <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.8;">${safeOrg} · Renewal reminder</p>
    <h1 style="margin:8px 0 0;font-size:22px;">${safeApp} renews ${when}</h1>
  </div>
  <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0;">
    ${input.forApprover ? `<p style="margin:0 0 12px;color:#475569;">You are copied because you approved this subscription.</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#64748b;">Renewal date</td><td style="padding:8px 0;text-align:right;font-weight:600;">${input.renewalDateKey}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(money)}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;">Lead time</td><td style="padding:8px 0;text-align:right;">${input.leadDays} day(s)</td></tr>
    </table>
    <p style="text-align:center;margin:24px 0 0;"><a href="${url}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Review subscription</a></p>
  </div>
  <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px;">Sent by SubHub for ${safeOrg}.</p>
</body></html>`;

  return {
    title,
    body,
    link,
    email: {
      subject: `[${input.organizationName}] ${title}`,
      html,
      text: `${body} ${url}`,
    },
    templateVars: {
      serviceName: input.appName,
      renewalDate: input.renewalDateKey,
      daysUntil: input.leadDays,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      billingCycle: input.billingCycle,
      ownerName: input.ownerName,
      organizationName: input.organizationName,
      link: url,
    },
  };
}
