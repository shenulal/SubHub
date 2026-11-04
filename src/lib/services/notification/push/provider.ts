// src/lib/services/notification/push/provider.ts
/**
 * Push delivery abstraction. The default provider only logs (no mobile client
 * yet). When `FCM_SERVER_KEY` is set the FCM legacy HTTP provider is used.
 */
import { logger } from "@/lib/logger";

export interface PushMessage {
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, string>;
}

export interface PushTarget {
  token: string;
  platform: "IOS" | "ANDROID" | "WEB";
}

export interface PushSendResult {
  sent: number;
  failed: number;
  /** Tokens the provider reported as invalid/unregistered (safe to delete). */
  invalidTokens: string[];
}

export interface PushProvider {
  readonly name: string;
  send(targets: PushTarget[], message: PushMessage): Promise<PushSendResult>;
}

export const logOnlyProvider: PushProvider = {
  name: "log-only",
  async send(targets, message) {
    logger.info(
      { count: targets.length, title: message.title },
      "[push:log-only] push suppressed (no provider configured)"
    );
    return { sent: 0, failed: 0, invalidTokens: [] };
  },
};

const FCM_LEGACY_ENDPOINT = "https://fcm.googleapis.com/fcm/send";
const FCM_INVALID_ERRORS = new Set([
  "NotRegistered",
  "InvalidRegistration",
  "MismatchSenderId",
]);

interface FcmResponse {
  success?: number;
  failure?: number;
  results?: Array<{ message_id?: string; error?: string }>;
}

/** FCM-ready HTTP provider (legacy server-key API). */
export function createFcmHttpProvider(
  serverKey: string,
  fetchImpl: typeof fetch = fetch
): PushProvider {
  return {
    name: "fcm-http",
    async send(targets, message) {
      if (targets.length === 0)
        return { sent: 0, failed: 0, invalidTokens: [] };
      try {
        const res = await fetchImpl(FCM_LEGACY_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify({
            registration_ids: targets.map((t) => t.token),
            notification: { title: message.title, body: message.body ?? "" },
            data: { ...(message.data ?? {}), link: message.link ?? "" },
          }),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, "[push:fcm] non-2xx response");
          return { sent: 0, failed: targets.length, invalidTokens: [] };
        }
        const json = (await res.json()) as FcmResponse;
        const invalidTokens = (json.results ?? [])
          .map((r, i) =>
            r.error && FCM_INVALID_ERRORS.has(r.error) ? targets[i].token : null
          )
          .filter((t): t is string => Boolean(t));
        return {
          sent: json.success ?? 0,
          failed: json.failure ?? 0,
          invalidTokens,
        };
      } catch (error) {
        logger.warn({ err: error }, "[push:fcm] send failed");
        return { sent: 0, failed: targets.length, invalidTokens: [] };
      }
    },
  };
}

let cached: PushProvider | null = null;

/** Resolve the configured provider (memoised). */
export function getPushProvider(): PushProvider {
  if (cached) return cached;
  const key = process.env.FCM_SERVER_KEY;
  cached = key ? createFcmHttpProvider(key) : logOnlyProvider;
  return cached;
}

/** Test seam. */
export function setPushProviderForTests(provider: PushProvider | null): void {
  cached = provider;
}
