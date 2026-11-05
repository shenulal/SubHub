// src/lib/services/notification/email-auth.ts
// Authentication e-mails (sign-up verification, password reset)

import { Resend } from "resend";

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY || "dummy-key-for-build";
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@subhub.local";
const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export interface VerificationEmailParams {
  to: string;
  token: string;
  userName?: string;
}

export interface PasswordResetEmailParams {
  to: string;
  token: string;
  userName?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Sends the e-mail verification message
 */
export async function sendVerificationEmail(
  params: VerificationEmailParams
): Promise<EmailResult> {
  const { to, token, userName } = params;
  const verifyUrl = `${BASE_URL}/verify-email/${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: "[SubHub] Please verify your email address",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email verification</h2>
          <p>${userName ? `Hello ${userName},` : "Hello,"}</p>
          <p>Thank you for signing up for SubHub.</p>
          <p>Please click the button below to verify your email address.</p>
          <div style="margin: 30px 0;">
            <a href="${verifyUrl}"
               style="background-color: #0070f3; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify email
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This link is valid for 24 hours.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you did not make this request, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            If the button does not work, copy the link below and paste it into your browser:<br />
            <a href="${verifyUrl}" style="color: #0070f3;">${verifyUrl}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send verification email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Verification email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
    };
  }
}

/**
 * Sends the password reset e-mail
 */
export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<EmailResult> {
  const { to, token, userName } = params;
  const resetUrl = `${BASE_URL}/reset-password/${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: "[SubHub] Password reset",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password reset</h2>
          <p>${userName ? `Hello ${userName},` : "Hello,"}</p>
          <p>We received a request to reset your password.</p>
          <p>Please click the button below to set a new password.</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #0070f3; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            This link is valid for 1 hour.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you did not make this request, please ignore this email. Your password will not be changed.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            If the button does not work, copy the link below and paste it into your browser:<br />
            <a href="${resetUrl}" style="color: #0070f3;">${resetUrl}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Password reset email error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
    };
  }
}

export interface OtpEmailParams {
  to: string;
  code: string;
  userName?: string;
}

export async function sendOtpEmail(
  params: OtpEmailParams
): Promise<EmailResult> {
  const { to, code, userName } = params;

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to,
      subject: "[SubHub] Sign-in verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Sign-in verification code</h2>
          <p>${userName ? `Hello ${userName},` : "Hello,"}</p>
          <p>Here is your verification code for signing in to SubHub.</p>
          <div style="margin: 30px 0; text-align: center;">
            <div style="display: inline-block; background-color: #f4f4f5;
                        padding: 16px 32px; border-radius: 8px;
                        font-size: 32px; font-weight: bold;
                        letter-spacing: 8px; font-family: monospace;">
              ${code}
            </div>
          </div>
          <p style="color: #666; font-size: 14px;">
            This code is valid for <strong>10 minutes</strong>.
          </p>
          <p style="color: #666; font-size: 14px;">
            If you did not make this request, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #999; font-size: 12px;">
            Do not share this code with anyone.
          </p>
        </div>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
    };
  }
}
