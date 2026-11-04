// src/lib/services/storage/local.ts
/**
 * Local-disk provider for development. Objects live under `.data/storage`
 * and are served by `/api/files/<key>` with an HMAC-signed, expiring URL.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  sanitizeKey,
  StorageKeyError,
  type StorageProvider,
  type StoredObject,
} from "./types";

export const DEFAULT_LOCAL_ROOT = ".data/storage";
export const LOCAL_FILES_ROUTE = "/api/files";
const META_SUFFIX = ".meta.json";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const MS_PER_SECOND = 1000;

interface ObjectMeta {
  contentType: string;
  sizeBytes: number;
}

export function localRoot(): string {
  return path.resolve(process.env.STORAGE_LOCAL_ROOT || DEFAULT_LOCAL_ROOT);
}

function signingSecret(): string {
  const secret =
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("STORAGE_SIGNING_SECRET is not configured");
  return secret;
}

/** Resolve `key` inside `root`, guaranteeing the result stays within it. */
export function resolveSafePath(root: string, key: string): string {
  const safeKey = sanitizeKey(key);
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, safeKey);
  if (!target.startsWith(resolvedRoot + path.sep)) {
    throw new StorageKeyError("Object key escapes storage root");
  }
  return target;
}

export function signLocalUrl(key: string, expiresAtSeconds: number): string {
  return createHmac("sha256", signingSecret())
    .update(`${key}:${expiresAtSeconds}`)
    .digest("hex");
}

export function verifyLocalSignature(
  key: string,
  expiresAtSeconds: number,
  signature: string,
  now: Date = new Date()
): boolean {
  if (!Number.isFinite(expiresAtSeconds)) return false;
  if (expiresAtSeconds * MS_PER_SECOND < now.getTime()) return false;
  const expected = Buffer.from(signLocalUrl(key, expiresAtSeconds), "hex");
  const given = Buffer.from(signature, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function createLocalProvider(
  root: string = localRoot()
): StorageProvider {
  return {
    id: "local",
    async putObject(key, body, contentType) {
      const target = resolveSafePath(root, key);
      await mkdir(path.dirname(target), { recursive: true });
      const meta: ObjectMeta = {
        contentType: contentType || DEFAULT_CONTENT_TYPE,
        sizeBytes: body.byteLength,
      };
      await writeFile(target, body);
      await writeFile(target + META_SUFFIX, JSON.stringify(meta));
      return { key: sanitizeKey(key), sizeBytes: body.byteLength };
    },
    async getSignedUrl(key, ttlSeconds) {
      const safeKey = sanitizeKey(key);
      const exp =
        Math.floor(Date.now() / MS_PER_SECOND) + Math.max(1, ttlSeconds);
      const sig = signLocalUrl(safeKey, exp);
      return `${LOCAL_FILES_ROUTE}/${safeKey}?exp=${exp}&sig=${sig}`;
    },
    async deleteObject(key) {
      const target = resolveSafePath(root, key);
      await rm(target, { force: true });
      await rm(target + META_SUFFIX, { force: true });
    },
    async getObject(key): Promise<StoredObject | null> {
      const target = resolveSafePath(root, key);
      try {
        const [body, metaRaw] = await Promise.all([
          readFile(target),
          readFile(target + META_SUFFIX, "utf8").catch(() => null),
        ]);
        const meta = metaRaw ? (JSON.parse(metaRaw) as ObjectMeta) : null;
        return { body, contentType: meta?.contentType ?? DEFAULT_CONTENT_TYPE };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}
