// src/i18n/messages/index.ts
/**
 * Message loader. en.json holds the base messages; each SubHub feature area owns
 * one namespace file under en/ so parallel work never conflicts. Files are
 * deep-merged in the order listed below.
 */
import type { Locale } from "@/i18n/config";

import enBase from "./en.json";
import enApprovals from "./en/approvals.json";
import enDiscovery from "./en/discovery.json";
import enLifecycle from "./en/lifecycle.json";
import enNotifications from "./en/notifications.json";
import enPlatform from "./en/platform.json";
import enReceipts from "./en/receipts.json";
import enTaxonomy from "./en/taxonomy.json";

type Messages = Record<string, unknown>;

function isObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergeMessages(...sources: Messages[]): Messages {
  return sources.reduce<Messages>((acc, src) => {
    const out: Messages = { ...acc };
    for (const [key, value] of Object.entries(src)) {
      const existing = out[key];
      out[key] =
        isObject(existing) && isObject(value)
          ? deepMergeMessages(existing, value)
          : value;
    }
    return out;
  }, {});
}

const FEATURE_MESSAGES: Record<Locale, Messages[]> = {
  en: [
    enPlatform,
    enApprovals,
    enTaxonomy,
    enLifecycle,
    enNotifications,
    enReceipts,
    enDiscovery,
  ],
};

const BASE_MESSAGES: Record<Locale, Messages> = { en: enBase };

const cache = new Map<Locale, Messages>();

export function getAllMessages(locale: Locale): Messages {
  const cached = cache.get(locale);
  if (cached) return cached;
  const merged = deepMergeMessages(
    BASE_MESSAGES[locale],
    ...FEATURE_MESSAGES[locale]
  );
  cache.set(locale, merged);
  return merged;
}
