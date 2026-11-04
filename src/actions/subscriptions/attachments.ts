"use server";

/**
 * Subscription attachments: list (with signed download URLs), upload and delete.
 * The multipart upload route (`/api/v1/subscriptions/[id]/attachments`) calls
 * `uploadAttachment` after reading the file.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  buildStorageKey,
  isKeyInOrganization,
  safeFileName,
  validateAttachment,
  type AttachmentValidationError,
} from "@/lib/services/subscription/attachments";
import {
  removeAttachmentObject,
  signedAttachmentUrl,
  storeAttachmentObject,
} from "@/lib/services/subscription/storage-adapter";
import { getSettings } from "@/lib/settings/service";
import { attachmentKindSchema } from "@/lib/validations/subscriptions";
import type { ActionState } from "@/types";
import type { AttachmentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  isNextNavigationError,
  LIFECYCLE_ERRORS,
  toActionError,
} from "./subscription-lifecycle.helpers";

/** Signed URLs are short-lived; the list is re-fetched when the tab opens. */
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

export interface AttachmentItem {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  downloadUrl: string | null;
  uploadedBy: { id: string; name: string | null; email: string } | null;
}

const ATTACHMENT_ERROR_MESSAGES: Record<AttachmentValidationError, string> = {
  empty: "The file is empty",
  too_large: "The file exceeds the maximum attachment size",
  mime_not_allowed: "This file type is not allowed",
  bad_name: "The file name is not valid",
};

async function _listAttachments(
  subscriptionId: string
): Promise<ActionState<AttachmentItem[]>> {
  try {
    const { organizationId } = await requirePermission("attachments:read");
    const rows = await prisma.attachment.findMany({
      where: { subscriptionId, organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });
    const items = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        kind: row.kind,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
        uploadedBy: row.uploadedBy,
        downloadUrl: await signedAttachmentUrl(
          row.storageKey,
          DOWNLOAD_URL_TTL_SECONDS
        ).catch(() => row.url ?? null),
      }))
    );
    return { success: true, data: items };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, subscriptionId }, "listAttachments");
    return toActionError(error);
  }
}
export const listAttachments = withLogging("listAttachments", _listAttachments);

export interface UploadAttachmentInput {
  subscriptionId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  kind?: string | null;
}

async function _uploadAttachment(
  input: UploadAttachmentInput
): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("attachments:upload");
    const subscription = await prisma.subscription.findFirst({
      where: { id: input.subscriptionId, organizationId },
      select: { id: true },
    });
    if (!subscription) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }

    const settings = await getSettings(organizationId, [
      "documents.maxAttachmentSizeMb",
      "documents.allowedMimeTypes",
    ]);
    const validation = validateAttachment(
      {
        sizeBytes: input.buffer.byteLength,
        mimeType: input.mimeType,
        fileName: input.fileName,
      },
      {
        maxSizeMb: settings["documents.maxAttachmentSizeMb"],
        allowedMimeTypes: settings["documents.allowedMimeTypes"],
      }
    );
    if (!validation.ok) {
      return {
        success: false,
        error: ATTACHMENT_ERROR_MESSAGES[validation.error ?? "bad_name"],
      };
    }
    const kindResult = attachmentKindSchema.safeParse(input.kind ?? "OTHER");
    const kind: AttachmentKind = kindResult.success ? kindResult.data : "OTHER";

    const storageKey = buildStorageKey(
      organizationId,
      input.subscriptionId,
      input.fileName
    );
    await storeAttachmentObject(storageKey, input.buffer, input.mimeType);

    const attachment = await prisma.attachment.create({
      data: {
        organizationId,
        subscriptionId: input.subscriptionId,
        uploadedById: userId,
        kind,
        fileName: safeFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.buffer.byteLength,
        storageKey,
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "UPLOAD_ATTACHMENT",
        entityType: "attachment",
        entityId: input.subscriptionId,
        metadata: {
          attachmentId: attachment.id,
          fileName: safeFileName(input.fileName),
          kind,
          sizeBytes: input.buffer.byteLength,
        },
      },
    });

    revalidatePath(`/subscriptions/${input.subscriptionId}`);
    return { success: true, data: attachment };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error }, "uploadAttachment");
    return toActionError(error);
  }
}
export const uploadAttachment = withLogging(
  "uploadAttachment",
  _uploadAttachment
);

async function _deleteAttachment(attachmentId: string): Promise<ActionState> {
  try {
    const { organizationId, userId } =
      await requirePermission("attachments:delete");
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId },
      select: {
        id: true,
        storageKey: true,
        subscriptionId: true,
        fileName: true,
      },
    });
    if (!attachment) {
      return { success: false, error: LIFECYCLE_ERRORS.notFound };
    }
    if (isKeyInOrganization(attachment.storageKey, organizationId)) {
      try {
        await removeAttachmentObject(attachment.storageKey);
      } catch (err) {
        logger.warn(
          { err, key: attachment.storageKey },
          "storage delete failed"
        );
      }
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: "DELETE_ATTACHMENT",
        entityType: "attachment",
        entityId: attachment.subscriptionId,
        metadata: {
          attachmentId: attachment.id,
          fileName: attachment.fileName,
        },
      },
    });
    revalidatePath(`/subscriptions/${attachment.subscriptionId}`);
    return { success: true };
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    logger.error({ err: error, attachmentId }, "deleteAttachment");
    return toActionError(error);
  }
}
export const deleteAttachment = withLogging(
  "deleteAttachment",
  _deleteAttachment
);
