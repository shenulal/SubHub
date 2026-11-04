// src/lib/services/storage/index.ts
/**
 * Storage abstraction. Feature code calls `putObject` / `getSignedUrl` /
 * `deleteObject`; the provider comes from the system setting
 * `documents.storageProvider` (env `STORAGE_PROVIDER` overrides it per deploy).
 */
import { getSystemSetting } from "@/lib/settings/service";
import { createLocalProvider } from "./local";
import { createS3Provider } from "./s3";
import type {
  PutObjectResult,
  StorageProvider,
  StorageProviderId,
  StoredObject,
} from "./types";

export { sanitizeKey, StorageKeyError } from "./types";
export { buildZip, type ZipEntry } from "./zip";
export type {
  PutObjectResult,
  StorageProvider,
  StorageProviderId,
  StoredObject,
};

const PROVIDER_IDS: readonly StorageProviderId[] = ["local", "r2", "s3"];

function isProviderId(value: unknown): value is StorageProviderId {
  return (
    typeof value === "string" && (PROVIDER_IDS as string[]).includes(value)
  );
}

const providers = new Map<StorageProviderId, StorageProvider>();

export async function resolveStorageProviderId(): Promise<StorageProviderId> {
  const envValue = process.env.STORAGE_PROVIDER;
  if (isProviderId(envValue)) return envValue;
  return getSystemSetting("documents.storageProvider");
}

export async function getStorageProvider(
  id?: StorageProviderId
): Promise<StorageProvider> {
  const providerId = id ?? (await resolveStorageProviderId());
  const cached = providers.get(providerId);
  if (cached) return cached;
  const provider =
    providerId === "local"
      ? createLocalProvider()
      : createS3Provider(providerId);
  providers.set(providerId, provider);
  return provider;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<PutObjectResult> {
  return (await getStorageProvider()).putObject(key, body, contentType);
}

export async function getSignedUrl(
  key: string,
  ttlSeconds: number
): Promise<string> {
  return (await getStorageProvider()).getSignedUrl(key, ttlSeconds);
}

export async function deleteObject(key: string): Promise<void> {
  return (await getStorageProvider()).deleteObject(key);
}

export async function getObject(key: string): Promise<StoredObject | null> {
  return (await getStorageProvider()).getObject(key);
}

/** Test hook */
export function resetStorageProviders(): void {
  providers.clear();
}
