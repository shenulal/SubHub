// src/lib/services/notification/center-email.ts
/**
 * Email leg of `notify()`: applies the organisation sender name / reply-to
 * and sends one message per recipient through Resend.
 */
import { logger } from "@/lib/logger";
import { getSettings } from "@/lib/settings/service";
import type { NotificationEventType } from "@prisma/client";
import { EmailConfig, getResendClient } from "./email.utils";

export interface NotifyEmailContent {
  subject: string;
  html: string;
  text?: string;
}

export interface NotifyEmailRecipient {
  email: string;
  content: NotifyEmailContent;
}

/** Send one email per recipient; returns the number delivered. */
export async function sendNotifyEmails(
  organizationId: string,
  recipients: NotifyEmailRecipient[],
  type: NotificationEventType
): Promise<number> {
  if (recipients.length === 0) return 0;
  const settings = await getSettings(organizationId, [
    "notifications.emailFromName",
    "notifications.emailReplyTo",
  ]);
  const fromName =
    settings["notifications.emailFromName"] || EmailConfig.fromName;
  const replyTo = settings["notifications.emailReplyTo"] || undefined;

  let sent = 0;
  for (const recipient of recipients) {
    try {
      await getResendClient().emails.send({
        from: `${fromName} <${EmailConfig.fromEmail}>`,
        to: recipient.email,
        subject: recipient.content.subject,
        html: recipient.content.html,
        text: recipient.content.text,
        replyTo,
      });
      sent++;
    } catch (error) {
      logger.warn(
        { err: error, to: recipient.email, type },
        "[notify] email failed"
      );
    }
  }
  return sent;
}
