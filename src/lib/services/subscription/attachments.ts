// src/lib/services/subscription/attachments.ts
/**
 * Attachment validation and storage-key helpers (pure except where noted).
 */
import { randomUUID } from "node:crypto";

export const BYTES_PER_MB = 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 120;

export interface AttachmentPolicy {
  maxSizeMb: number;
  allowedMimeTypes: string[];
}

export type AttachmentValidationError =
  | "empty"
  | "too_large"
  | "mime_not_allowed"
  | "bad_name";

export interface AttachmentValidationResult {
  ok: boolean;
  error?: AttachmentValidationError;
}

/** Strip path separators and unsafe characters from a user-supplied file name. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "");
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH) || "file";
}

export function validateAttachment(
  input: { sizeBytes: number; mimeType: string; fileName: string },
  policy: AttachmentPolicy
): AttachmentValidationResult {
  if (input.sizeBytes <= 0) return { ok: false, error: "empty" };
  if (input.sizeBytes > policy.maxSizeMb * BYTES_PER_MB) {
    return { ok: false, error: "too_large" };
  }
  const mime = input.mimeType.toLowerCase().split(";")[0].trim();
  if (!policy.allowedMimeTypes.map((m) => m.toLowerCase()).includes(mime)) {
    return { ok: false, error: "mime_not_allowed" };
  }
  if (!safeFileName(input.fileName)) return { ok: false, error: "bad_name" };
  return { ok: true };
}

/** `org/<orgId>/subscriptions/<subscriptionId>/<uuid>-<safeName>` */
export function buildStorageKey(
  organizationId: string,
  subscriptionId: string,
  fileName: string,
  id: string = randomUUID()
): string {
  return `org/${organizationId}/subscriptions/${subscriptionId}/${id}-${safeFileName(fileName)}`;
}

/** Key must stay inside the organisation prefix (defence against tampering). */
export function isKeyInOrganization(
  key: string,
  organizationId: string
): boolean {
  return key.startsWith(`org/${organizationId}/`) && !key.includes("..");
}
