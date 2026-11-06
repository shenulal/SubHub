// src/lib/services/app-logo/index.ts
/**
 * App icons. An uploaded icon arrives as a `data:image/...;base64,` URL (from
 * the full app form, the quick-create dialog or the REST API); it is checked
 * (raster formats only, verified by magic bytes; SVG rejected; size from
 * `documents.appLogoMaxSizeKb`) and written to the configured storage provider
 * (`local` disk by default — no cloud keys needed on-premise — or S3/R2). The
 * app stores the stable path `/api/v1/app-logos/<orgId>/<file>`, served to
 * signed-in members of that organisation. External https URLs and relative
 * paths (template icons) are kept as given.
 */
import { logger } from "@/lib/logger";
import { deleteObject, putObject } from "@/lib/services/storage";
import { getSetting } from "@/lib/settings/service";
import { randomUUID } from "node:crypto";

export const APP_LOGO_ROUTE = "/api/v1/app-logos";
const KEY_PREFIX = "app-logos";
const MAX_URL_LENGTH = 2048;
const BYTES_PER_KB = 1024;

export type AppLogoMime =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp";

const EXTENSIONS: Record<AppLogoMime, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export class AppLogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppLogoError";
  }
}

export function isAppLogoError(error: unknown): error is AppLogoError {
  return error instanceof AppLogoError;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((b, i) => buf[offset + i] === b);
}

/** Detects the real image type from the file header (never trusts the client). */
export function sniffImageType(buf: Buffer): AppLogoMime | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(buf, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return "image/webp";
  return null;
}

const DATA_URL =
  /^data:([a-z0-9.+/-]+)?(;[a-z0-9=.+-]+)*?;base64,([a-z0-9+/=\s]+)$/i;

export function isDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith("data:");
}

/** Decodes a base64 image data URL; throws AppLogoError for anything else. */
export function decodeImageDataUrl(value: string): {
  declared: string;
  body: Buffer;
} {
  const match = DATA_URL.exec(value.trim());
  if (!match) throw new AppLogoError("The icon could not be read");
  const declared = (match[1] ?? "").toLowerCase();
  if (declared.includes("svg")) {
    throw new AppLogoError(
      "SVG icons are not accepted. Upload a PNG, JPEG, WebP or GIF image."
    );
  }
  return { declared, body: Buffer.from(match[3].replace(/\s/g, ""), "base64") };
}

/** Validates bytes and returns the detected type. */
export function validateLogoBytes(body: Buffer, maxKb: number): AppLogoMime {
  if (body.byteLength === 0) throw new AppLogoError("The icon file is empty");
  if (body.byteLength > maxKb * BYTES_PER_KB) {
    throw new AppLogoError(`The icon is larger than ${maxKb} KB`);
  }
  const type = sniffImageType(body);
  if (!type) {
    throw new AppLogoError(
      "Only PNG, JPEG, WebP or GIF images can be used as an app icon"
    );
  }
  return type;
}

export function isManagedLogoUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.startsWith(`${APP_LOGO_ROUTE}/`));
}

const ORG_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const FILE_SEGMENT = /^[a-f0-9-]{36}\.(png|jpg|gif|webp)$/;

/** Storage key for `<orgId>/<file>` segments, or null when the shape is wrong. */
export function logoKeyFromSegments(segments: string[]): {
  key: string;
  organizationId: string;
} | null {
  if (segments.length !== 2) return null;
  const [org, file] = segments;
  if (!ORG_SEGMENT.test(org) || !FILE_SEGMENT.test(file)) return null;
  return { key: `${KEY_PREFIX}/${org}/${file}`, organizationId: org };
}

function keyFromManagedUrl(url: string): string | null {
  const rest = url.slice(APP_LOGO_ROUTE.length + 1).split("?")[0];
  return logoKeyFromSegments(rest.split("/"))?.key ?? null;
}

function validateUrl(value: string, organizationId: string): string {
  if (value.length > MAX_URL_LENGTH)
    throw new AppLogoError("The icon URL is too long");
  if (isManagedLogoUrl(value)) {
    const parsed = logoKeyFromSegments(
      value.slice(APP_LOGO_ROUTE.length + 1).split("/")
    );
    if (!parsed || parsed.organizationId !== organizationId) {
      throw new AppLogoError("The icon URL is not valid");
    }
    return value;
  }
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return value;
  } catch {
    // fall through
  }
  throw new AppLogoError("Enter an https:// image URL or upload an image");
}

/** Writes an uploaded icon to storage and returns its app-facing path. */
export async function storeAppLogo(
  organizationId: string,
  body: Buffer
): Promise<string> {
  const maxKb = await getSetting(organizationId, "documents.appLogoMaxSizeKb");
  const type = validateLogoBytes(body, maxKb);
  const file = `${randomUUID()}.${EXTENSIONS[type]}`;
  await putObject(`${KEY_PREFIX}/${organizationId}/${file}`, body, type);
  return `${APP_LOGO_ROUTE}/${organizationId}/${file}`;
}

/**
 * Normalises the `customLogoUrl` an app form sent: empty → null, data URL →
 * stored file path, URL / path → validated as is. Throws AppLogoError.
 */
export async function resolveLogoInput(
  organizationId: string,
  raw: string | null | undefined
): Promise<string | null> {
  const value = raw?.trim();
  if (!value) return null;
  if (isDataUrl(value)) {
    const { body } = decodeImageDataUrl(value);
    return storeAppLogo(organizationId, body);
  }
  return validateUrl(value, organizationId);
}

/** Removes a stored icon that is no longer referenced (best effort). */
export async function deleteManagedLogo(url: string | null | undefined) {
  if (!url || !isManagedLogoUrl(url)) return;
  const key = keyFromManagedUrl(url);
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (error) {
    logger.warn({ err: error, key }, "[app-logo] could not delete old icon");
  }
}
