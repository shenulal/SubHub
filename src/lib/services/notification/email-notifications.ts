// src/lib/services/notification/email-notifications.ts
/**
 * Notification e-mails: LLM confirmation results, weekly summary
 */
import type {
  ConfirmationResultEmailParams,
  EmailResult,
  WeeklyDigestEmailParams,
} from "./email.types";
import { EmailConfig, getBaseUrl, getResendClient } from "./email.utils";

/**
 * LLM confirmation result notification
 */
export async function sendConfirmationResultEmail(
  params: ConfirmationResultEmailParams
): Promise<EmailResult> {
  const { to, organizationName, appName, action, confidence, normalizedName } =
    params;

  const isApproved = action === "approved";
  const subject = isApproved
    ? `✅ [Review complete] ${appName} has been approved as SaaS`
    : `⛔ [Review complete] ${appName} has been blocked as non-SaaS`;

  const confidenceText =
    typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "N/A";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Lato, Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${isApproved ? "#22c55e" : "#f97316"} 0%, ${isApproved ? "#16a34a" : "#ea580c"} 100%); padding: 28px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${
          isApproved ? "✅ Approved as SaaS" : "⛔ Blocked as non-SaaS"
        }</h1>
      </div>

      <div style="background: #f8f9fa; padding: 26px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 15px;">Dear <strong>${organizationName}</strong> administrator,</p>
        <p style="font-size: 14px; color: #555; margin-top: 8px;">
          An item awaiting review on your dashboard has been processed.
        </p>

        <div style="background: white; padding: 18px; border-radius: 8px; margin: 18px 0; border-left: 4px solid ${
          isApproved ? "#22c55e" : "#f97316"
        };">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #666;">App name</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600;">${appName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666;">Action</td>
              <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${
                isApproved ? "#16a34a" : "#ea580c"
              };">${isApproved ? "Approved as SaaS (ACTIVE)" : "Blocked as non-SaaS (BLOCKED)"}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #666;">Confidence</td>
              <td style="padding: 6px 0; text-align: right;">${confidenceText}</td>
            </tr>
            ${
              normalizedName
                ? `<tr>
                    <td style="padding: 6px 0; color: #666;">Normalised name</td>
                    <td style="padding: 6px 0; text-align: right;">${normalizedName}</td>
                  </tr>`
                : ""
            }
          </table>
        </div>

        <p style="font-size: 13px; color: #666;">
          For further reviews, please use the "Needs review" card on your dashboard.
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${getBaseUrl()}/settings/saas-review"
             style="display: inline-block; background: ${
               isApproved ? "#22c55e" : "#ea580c"
             }; color: white; padding: 11px 26px; text-decoration: none; border-radius: 6px; font-weight: 600;">
            View review history
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 16px; color: #999; font-size: 12px;">
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
 * Sends the weekly summary e-mail
 */
export async function sendWeeklyDigestEmail(
  params: WeeklyDigestEmailParams
): Promise<EmailResult> {
  const { to, organizationName, weekRange, stats } = params;

  const subject = `📊 Weekly Summary Report (${weekRange})`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Lato, Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%); padding: 26px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">📊 Weekly Summary Report</h1>
        <p style="color: #e0f2fe; margin: 6px 0 0;">${organizationName} &middot; ${weekRange}</p>
      </div>

      <div style="background: #f8fafc; padding: 22px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="font-size: 14px; color: #475569; margin: 0 0 12px;">Dear <strong>${organizationName}</strong> administrator,</p>
        <p style="font-size: 13px; color: #475569; margin: 0 0 18px;">Here is a summary of last week's SaaS management activity.</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">New apps registered</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #0f172a;">${stats.newApps}</p>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Unmatched payments</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #0f172a;">${stats.unmatchedPayments}</p>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Upcoming renewals</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #0f172a;">${stats.upcomingRenewals}</p>
          </div>
          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Needs review (LLM)</p>
            <p style="margin: 6px 0 0; font-size: 22px; font-weight: 700; color: #0f172a;">${stats.pendingConfirmations}</p>
          </div>
        </div>

        <p style="font-size: 13px; color: #475569; margin: 18px 0 0;">
          Please review the details on your dashboard and take any necessary action.
        </p>

        <div style="margin-top: 18px; text-align: center;">
          <a href="${getBaseUrl()}/dashboard"
             style="display: inline-block; background: #6366f1; color: white; padding: 11px 26px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Open dashboard
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
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
