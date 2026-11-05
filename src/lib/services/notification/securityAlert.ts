// src/lib/services/notification/securityAlert.ts
import { Resend } from "resend";

import { formatMoney } from "@/lib/fx/convert";

import { mirrorAlertInApp } from "./alert-bridge";

// Lazily initialise the Resend client (works at build time without environment variables)
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resend = new Resend(apiKey);
  }
  return resend;
}

// E-mail configuration
const EmailConfig = {
  fromEmail: process.env.EMAIL_FROM || "noreply@subhub.local",
  fromName: process.env.EMAIL_FROM_NAME || "SubHub",
  get from() {
    return `${this.fromName} <${this.fromEmail}>`;
  },
};

// Result type
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Shadow IT alert parameters
export interface ShadowITAlertParams {
  to: string;
  /** When set, an in-app notification is mirrored for the recipient. */
  organizationId?: string;
  recipientUserId?: string;
  organizationName: string;
  shadowApps: Array<{
    name: string;
    detectedAt: Date;
    source: string;
  }>;
}

// Cost anomaly alert parameters
export interface CostAnomalyAlertParams {
  to: string;
  /** When set, an in-app notification is mirrored for the recipient. */
  organizationId?: string;
  recipientUserId?: string;
  organizationName: string;
  appName: string;
  previousCost: number;
  currentCost: number;
  percentageIncrease: number;
  currency: string;
  period: string;
}

// Formats an amount
function formatCurrency(amount: number, currency: string): string {
  return formatMoney(amount, currency, "en-US");
}

// Formats a date
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

// Maps a source to its display label
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    card: "Card payment",
    sso: "SSO sign-in",
    fleetdm: "FleetDM",
    manual: "Manual entry",
  };
  return labels[source] || source;
}

// Sends the Shadow IT alert e-mail
export async function sendShadowITAlertEmail(
  params: ShadowITAlertParams
): Promise<EmailResult> {
  const { to, organizationName, shadowApps, organizationId, recipientUserId } =
    params;

  const subject = `🚨 [Shadow IT Warning] ${shadowApps.length} unapproved SaaS app(s) detected`;

  const appListHtml = shadowApps
    .map(
      (app) =>
        `<tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500;">${app.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">${formatDate(app.detectedAt)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: #666;">${getSourceLabel(app.source)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Lato, Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Shadow IT Warning</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear <strong>${organizationName}</strong> administrator,</p>

        <div style="background: #fff3f3; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e74c3c;">
          <p style="margin: 0; color: #c0392b; font-weight: bold;">
            ${shadowApps.length} unapproved SaaS app(s) have been detected in your organization.
          </p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; overflow: hidden;">
          <h3 style="margin: 0 0 15px; color: #e74c3c;">Detected apps</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">App name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Detected on</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Detection source</th>
              </tr>
            </thead>
            <tbody>
              ${appListHtml}
            </tbody>
          </table>
        </div>

        <div style="background: #fff9e6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f1c40f;">
          <h4 style="margin: 0 0 10px; color: #d35400;">⚠️ Recommended actions</h4>
          <ul style="margin: 0; padding-left: 20px; color: #666;">
            <li style="margin-bottom: 8px;">Confirm the purpose of and need for each app</li>
            <li style="margin-bottom: 8px;">Review compliance with your security policy</li>
            <li style="margin-bottom: 8px;">Where appropriate, register the app officially or block its use</li>
          </ul>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/apps"
             style="display: inline-block; background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Manage apps
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This is an automated message from SubHub.</p>
        <p>© ${new Date().getFullYear()} SubHub</p>
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
      type: "SHADOW_IT",
      title: `${shadowApps.length} unapproved SaaS app(s) detected`,
      body: shadowApps.map((a) => a.name).join(", "),
      link: "/extensions/review-apps",
      dedupeKey: `shadow-it:${new Date().toISOString().slice(0, 10)}:${shadowApps.length}`,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email delivery failed",
    };
  }
}

// Sends the cost anomaly alert e-mail
export async function sendCostAnomalyAlertEmail(
  params: CostAnomalyAlertParams
): Promise<EmailResult> {
  const {
    to,
    organizationName,
    appName,
    previousCost,
    currentCost,
    percentageIncrease,
    currency,
    period,
    organizationId,
    recipientUserId,
  } = params;

  const isCritical = percentageIncrease >= 100;
  const urgencyEmoji = isCritical ? "🚨" : "⚠️";
  const subject = `${urgencyEmoji} [Cost Anomaly Detected] ${appName} - ${percentageIncrease}% increase`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Lato, Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${isCritical ? "#e74c3c 0%, #c0392b" : "#f39c12 0%, #d68910"} 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">${urgencyEmoji} Cost Anomaly Detected</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Dear <strong>${organizationName}</strong> administrator,</p>

        <div style="background: ${isCritical ? "#fff3f3" : "#fff9e6"}; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isCritical ? "#e74c3c" : "#f1c40f"};">
          <p style="margin: 0; color: ${isCritical ? "#c0392b" : "#d35400"}; font-weight: bold;">
            The cost of ${appName} has increased by ${percentageIncrease}% compared with the previous month.
          </p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isCritical ? "#e74c3c" : "#f1c40f"};">
          <h2 style="margin: 0 0 15px; color: ${isCritical ? "#e74c3c" : "#f39c12"};">${appName}</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #666;">Period</td>
              <td style="padding: 12px 0; text-align: right; font-weight: bold;">${period}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666;">Previous cost</td>
              <td style="padding: 12px 0; text-align: right;">${formatCurrency(previousCost, currency)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666;">Current cost</td>
              <td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${isCritical ? "#e74c3c" : "#f39c12"};">${formatCurrency(currentCost, currency)}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 12px; color: #666; font-weight: bold;">Increase</td>
              <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 18px; color: ${isCritical ? "#e74c3c" : "#f39c12"};">+${percentageIncrease}%</td>
            </tr>
          </table>
        </div>

        <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
          <h4 style="margin: 0 0 10px; color: #2980b9;">💡 Things to check</h4>
          <ul style="margin: 0; padding-left: 20px; color: #666;">
            <li style="margin-bottom: 8px;">Check whether users or licences were added</li>
            <li style="margin-bottom: 8px;">Check whether the pricing plan changed</li>
            <li style="margin-bottom: 8px;">Review for unusual usage patterns</li>
          </ul>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reports/cost"
             style="display: inline-block; background: ${isCritical ? "#e74c3c" : "#f39c12"}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            View cost report
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This is an automated message from SubHub.</p>
        <p>© ${new Date().getFullYear()} SubHub</p>
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
      type: "COST_ANOMALY",
      title: `${appName} cost up ${percentageIncrease}% (${period})`,
      body: `${formatCurrency(previousCost, currency)} → ${formatCurrency(currentCost, currency)}`,
      link: "/cost",
      dedupeKey: `cost-anomaly:${appName}:${period}`,
    });

    return { success: true, messageId: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email delivery failed",
    };
  }
}
