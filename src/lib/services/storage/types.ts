// src/lib/services/storage/types.ts

export type StorageProviderId = "local" | "r2" | "s3";

export interface PutObjectResult {
  key: string;
  sizeBytes: number;
}

export interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface StorageProvider {
  id: StorageProviderId;
  putObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<PutObjectResult>;
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  getObject(key: string): Promise<StoredObject | null>;
}

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageKeyError";
  }
}

/** Allowed characters inside an object key segment. */
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_KEY_LENGTH = 512;

/**
 * Validate and normalise an object key. Rejects absolute paths, traversal,
 * backslashes, hidden segments and anything outside `[A-Za-z0-9._-]/`.
 */
export function sanitizeKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new StorageKeyError("Object key is required");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new StorageKeyError("Object key too long");
  }
  if (key.includes("\\") || key.includes("\0")) {
    throw new StorageKeyError("Object key contains illegal characters");
  }
  const segments = key.split("/");
  if (segments.some((s) => s.length === 0)) {
    throw new StorageKeyError("Object key has empty path segments");
  }
  for (const segment of segments) {
    if (segment === "." || segment === ".." || segment.startsWith(".")) {
      throw new StorageKeyError("Object key segment not allowed");
    }
    if (!SEGMENT_PATTERN.test(segment)) {
      throw new StorageKeyError(`Invalid key segment "${segment}"`);
    }
  }
  return segments.join("/");
}
