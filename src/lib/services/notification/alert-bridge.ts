// src/lib/services/notification/alert-bridge.ts
/**
 * Bridges the legacy email-only alert senders (shadow IT, cost anomaly,
 * offboarding, agent reminder) into the unified centre: after an email is
 * sent, an in-app row is created for the same recipient.
 *
 * `center` is imported lazily so the legacy mailers stay free of DB/settings
 * imports for callers (and tests) that do not pass `organizationId`.
 */
import { logger } from "@/lib/logger";
import type { NotificationEventType } from "@prisma/client";

export interface InAppMirrorParams {
  /** Organisation of the recipient. Without it the mirror is skipped. */
  organizationId?: string;
  /** Recipient user id; when absent the user is resolved by `recipientEmail`. */
  recipientUserId?: string;
  recipientEmail?: string;
  type: NotificationEventType;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Creates the in-app counterpart of an alert email. Never throws. */
export async function mirrorAlertInApp(
  params: InAppMirrorParams
): Promise<number> {
  if (!params.organizationId) return 0;
  try {
    const { notify } = await import("./center");
    let userId = params.recipientUserId;
    if (!userId && params.recipientEmail) {
      const { prisma } = await import("@/lib/db");
      const user = await prisma.user.findFirst({
        where: {
          email: params.recipientEmail,
          organizationId: params.organizationId,
        },
        select: { id: true },
      });
      userId = user?.id;
    }
    if (!userId) return 0;
    const res = await notify({
      organizationId: params.organizationId,
      userIds: [userId],
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      dedupeKey: params.dedupeKey,
      metadata: params.metadata,
      channels: ["IN_APP"],
    });
    return res.inAppCreated;
  } catch (error) {
    logger.warn(
      { err: error, type: params.type },
      "[notify] in-app mirror failed"
    );
    return 0;
  }
}
