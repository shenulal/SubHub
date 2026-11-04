// src/lib/services/subscription/storage-adapter.ts
/**
 * Thin adapter over the platform storage module (`@/lib/services/storage`,
 * owned by the platform agent). Attachment code imports from here so tests can
 * mock a single surface.
 */
// Dynamic import keeps this adapter loadable while the storage module lands.
async function storage() {
  return import("@/lib/services/storage");
}

export async function storeAttachmentObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const { putObject } = await storage();
  await putObject(key, buffer, contentType);
}

export async function signedAttachmentUrl(
  key: string,
  ttlSeconds: number
): Promise<string> {
  const { getSignedUrl } = await storage();
  return getSignedUrl(key, ttlSeconds);
}

export async function removeAttachmentObject(key: string): Promise<void> {
  const { deleteObject } = await storage();
  await deleteObject(key);
}
