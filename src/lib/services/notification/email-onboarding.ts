// src/lib/services/notification/email-onboarding.ts
/**
 * Onboarding e-mails: welcome, invitation, extension onboarding guide
 */
import type {
  EmailResult,
  ExtensionOnboardingGuideEmailParams,
  InvitationEmailParams,
  WelcomeEmailParams,
} from "./email.types";
import { EmailConfig, getBaseUrl, getResendClient } from "./email.utils";

/**
 * Sends the welcome e-mail
 */
export async function sendWelcomeEmail(
  params: WelcomeEmailParams
): Promise<EmailResult> {
  const { to, userName, organizationName } = params;

  const subject = `🎉 Welcome to ${organizationName}!`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome!</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px;">Hello <strong>${userName}</strong>,</p>

        <p style="font-size: 16px;">
          Thank you for joining SubHub for <strong>${organizationName}</strong>.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px; color: #667eea;">🚀 Getting started</h3>
          <ul style="padding-left: 20px; color: #666;">
            <li style="margin-bottom: 10px;">Connect your SSO/IdP to discover SaaS apps automatically</li>
            <li style="margin-bottom: 10px;">Register your subscriptions and receive renewal alerts</li>
            <li style="margin-bottom: 10px;">Track offboarded users' accounts to strengthen security</li>
          </ul>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${getBaseUrl()}/dashboard"
             style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Go to dashboard
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>If you have any questions, please do not hesitate to contact us.</p>
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
 * Sends the extension onboarding guide e-mail
 */
export async function sendExtensionOnboardingGuideEmail(
  params: ExtensionOnboardingGuideEmailParams
): Promise<EmailResult> {
  const { to, userName, orgName } = params;

  const subject = `🚀 ${orgName} Chrome Extension onboarding guide`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 26px;">🔌 Extension Onboarding Guide</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 18px;">Hello <strong>${userName}</strong>,</p>

        <p style="font-size: 16px;">
          <strong>${orgName}</strong> has deployed the Chrome Extension.<br>
          Set up the extension to start monitoring SaaS usage.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
          <h3 style="margin: 0 0 15px; color: #4F46E5;">📋 Getting started with the extension</h3>
          <ol style="padding-left: 20px; color: #555;">
            <li style="margin-bottom: 10px;">Check that the extension is installed in your Chrome browser</li>
            <li style="margin-bottom: 10px;">Click the extension icon and complete the onboarding screens</li>
            <li style="margin-bottom: 10px;">Complete verification with your company email account</li>
          </ol>
        </div>

        <div style="background: #EEF2FF; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #4338CA;">
            💡 <strong>Note</strong>: the extension automatically collects access activity for work SaaS apps.
            No personal information is collected, and it operates in line with company policy.
          </p>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${getBaseUrl()}/dashboard"
             style="display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Go to dashboard
          </a>
        </div>
      </div>

      <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
        <p>This email was sent by the ${orgName} administrator.</p>
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
 * Sends the invitation e-mail
 */
export async function sendInvitationEmail(
  params: InvitationEmailParams
): Promise<EmailResult> {
  const {
    email,
    token,
    organizationName = "your organization",
    inviterName = "An administrator",
    role = "MEMBER",
  } = params;

  const roleLabels: Record<string, string> = {
    ADMIN: "Admin",
    MEMBER: "Member",
    VIEWER: "Viewer",
  };

  const roleLabel = roleLabels[role] || "Member";
  const inviteUrl = `${getBaseUrl()}/invite/${token}`;

  const subject = `📩 You have been invited to ${organizationName}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📩 Team Invitation</h1>
      </div>

      <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">Hello,</p>

        <p style="font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to join SubHub for
          <strong>${organizationName}</strong> as <strong>${roleLabel}</strong>.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
          <h3 style="margin: 0 0 15px; color: #667eea;">🚀 What you can do with SubHub</h3>
          <ul style="padding-left: 20px; color: #666;">
            <li style="margin-bottom: 10px;">See all of your organization's SaaS apps at a glance</li>
            <li style="margin-bottom: 10px;">Manage subscription costs and renewal dates</li>
            <li style="margin-bottom: 10px;">Track app access for each user</li>
          </ul>
        </div>

        <div style="margin-top: 30px; text-align: center;">
          <a href="${inviteUrl}"
             style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Accept invitation
          </a>
        </div>

        <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
          This invitation expires in 7 days.
        </p>
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
      to: [email],
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
