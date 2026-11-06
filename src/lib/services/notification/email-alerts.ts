// src/lib/services/notification/email-alerts.ts
/**
 * Alert e-mails: renewal alerts, offboarded-user account alerts
 */
import { mirrorAlertInApp } from "./alert-bridge";
import type {
  EmailResult,
  RenewalAlertEmailParams,
  TerminatedUserAlertParams,
} from "./email.types";
import {
  EmailConfig,
  formatCurrency,
  formatDate,
  getBaseUrl,
  getResendClient,
} from "./email.utils";

/**
 * Sends a renewal alert e-mail
 */
export async function sendRenewalAlertEmail(
  params: RenewalAlertEmailParams
): Promise<EmailResult> {
  const {
    to,
    appName,
    renewalDate,
    daysUntilRenewal,
    amount,
    currency,
    organizationName,
  } = params;

  const urgencyText =
    daysUntilRenewal <= 30
      ? "⚠️ Urgent"
      : daysUntilRenewal <= 60
        ? "📅 Reminder"
        : "📋 Advance notice";

  const subject = `${urgencyText} [${appName}] Subscription renews in ${daysUntilRenewal} days`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔔 Subscription Renewal Alert</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear <strong>${organizationName}</strong> administrator,</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <h2 style="margin: 0 0 15px; color: #667eea;">${appName}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Renewal date</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatDate(renewalDate)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Time remaining</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${daysUntilRenewal <= 30 ? "#e74c3c" : "#667eea"};">${daysUntilRenewal} days</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Renewal amount</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${formatCurrency(amount, currency)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 14px; color: #666;">
          Please review whether this subscription should be renewed and, if required, update its settings on the platform.
        </p>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${getBaseUrl()}/subscriptions"
             style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Manage subscriptions
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This is an automated message from SubHub.</p>
        <p>&copy; ${new Date().getFullYear()} SubHub</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: EmailConfig.from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email delivery failed",
    };
  }
}

/**
 * Sends an alert e-mail about an offboarded user's unrevoked accounts
 */
export async function sendTerminatedUserAlertEmail(
  params: TerminatedUserAlertParams
): Promise<EmailResult> {
  const {
    to,
    terminatedUserName,
    terminatedUserEmail,
    unrevokedApps,
    terminatedAt,
    organizationName,
    organizationId,
    recipientUserId,
  } = params;

  const subject = `⚠️ [${terminatedUserName}] Offboarded user: ${unrevokedApps.length} unrevoked account(s) found`;

  const appListHtml = unrevokedApps
    .map(
      (app) =>
        `<li style="margin-bottom: 8px; padding: 10px; background: #fff3f3; border-radius: 4px; border-left: 3px solid #e74c3c;">${app}</li>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Offboarded User Account Alert</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear <strong>${organizationName}</strong> administrator,</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
          <h2 style="margin: 0 0 15px; color: #e74c3c;">Offboarded user details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">Name</td>
              <td style="padding: 8px 0; text-align: right; font-weight: bold;">${terminatedUserName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Email</td>
              <td style="padding: 8px 0; text-align: right;">${terminatedUserEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Offboarding date</td>
              <td style="padding: 8px 0; text-align: right;">${formatDate(terminatedAt)}</td>
            </tr>
          </table>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px; color: #e74c3c;">🔓 Unrevoked accounts (${unrevokedApps.length})</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${appListHtml}
          </ul>
        </div>

        <p style="font-size: 14px; color: #e74c3c; font-weight: bold;">
          For security, please revoke these accounts immediately.
        </p>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${getBaseUrl()}/users"
             style="display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Manage accounts
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This is an automated message from SubHub.</p>
        <p>&copy; ${new Date().getFullYear()} SubHub</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { data, error } = await getResendClient().emails.send({
      from: EmailConfig.from,
      to: [to],
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await mirrorAlertInApp({
      organizationId,
      recipientUserId,
      recipientEmail: to,
      type: "OFFBOARDING",
      title: `${terminatedUserName}: ${unrevokedApps.length} unrevoked app access(es)`,
      body: unrevokedApps.join(", "),
      link: "/security",
      dedupeKey: `offboarding:${terminatedUserEmail}:${unrevokedApps.length}`,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email delivery failed",
    };
  }
}
