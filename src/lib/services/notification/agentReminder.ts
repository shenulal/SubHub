// src/lib/services/notification/agentReminder.ts
import { Resend } from "resend";

import { mirrorAlertInApp } from "./alert-bridge";
import { EmailConfig, type EmailResult } from "./email";

// Lazily initialise the Resend client
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resend = new Resend(apiKey);
  }
  return resend;
}

// Agent installation reminder e-mail parameters
export interface AgentInstallationReminderParams {
  to: string;
  userName: string | null;
  organizationName: string;
  /** When set, an in-app notification is mirrored for the recipient. */
  organizationId?: string;
  recipientUserId?: string;
}

/**
 * Sends the FleetDM agent installation reminder e-mail
 */
export async function sendAgentInstallationReminderEmail(
  params: AgentInstallationReminderParams
): Promise<EmailResult> {
  const { to, userName, organizationName, organizationId, recipientUserId } =
    params;

  const displayName = userName || to.split("@")[0];
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const installGuideUrl = `${appUrl}/devices`;

  const subject = `[${organizationName}] FleetDM agent installation request`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Lato, Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💻 FleetDM Agent Installation</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Hello <strong>${displayName}</strong>,</p>

        <p style="font-size: 14px; color: #666;">
          <strong>${organizationName}</strong> requests that you install the FleetDM agent for IT asset management.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
          <h2 style="margin: 0 0 15px; color: #3b82f6; font-size: 18px;">What is the agent?</h2>
          <p style="margin: 0; color: #666; font-size: 14px;">
            The FleetDM agent is a lightweight program that securely manages the software used across the company
            and protects your device from security threats.
          </p>
        </div>

        <div style="background: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px; color: #1d4ed8; font-size: 16px;">✅ Why installation is required</h3>
          <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px;">
            <li>Compliance with company security policy</li>
            <li>Software licence management</li>
            <li>More efficient IT support</li>
          </ul>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${installGuideUrl}"
             style="display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View installation guide
          </a>
        </div>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; color: #92400e;">
            ⚠️ If you have any difficulty installing it, please contact the IT team. We can assist you remotely.
          </p>
        </div>

        <p style="font-size: 14px; color: #666; margin-top: 30px;">
          Kind regards,<br>
          <strong>${organizationName}</strong> IT Team
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This email was sent automatically by the ${organizationName} IT asset management system.</p>
      </div>
    </body>
    </html>
  `;

  try {
    const client = getResendClient();
    const response = await client.emails.send({
      from: EmailConfig.from,
      to,
      subject,
      html,
    });

    if (response.data?.id) {
      await mirrorAlertInApp({
        organizationId,
        recipientUserId,
        recipientEmail: to,
        type: "SYSTEM",
        title: "Install the device agent",
        body: `${organizationName} asks you to install the FleetDM agent.`,
        link: "/devices",
        dedupeKey: `agent-reminder:${to}:${new Date().toISOString().slice(0, 10)}`,
      });
      return { success: true, messageId: response.data.id };
    }

    return {
      success: false,
      error: "Failed to send email",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
