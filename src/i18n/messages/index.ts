// src/i18n/messages/index.ts
/**
 * Message loader. The base files (en.json / ko.json) are inherited from saaslens;
 * each SubHub feature area owns one namespace file under en/ and ko/ so parallel
 * work never conflicts. Files are deep-merged in the order listed below.
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
import koBase from "./ko.json";
import koApprovals from "./ko/approvals.json";
import koDiscovery from "./ko/discovery.json";
import koLifecycle from "./ko/lifecycle.json";
import koNotifications from "./ko/notifications.json";
import koPlatform from "./ko/platform.json";
import koReceipts from "./ko/receipts.json";
import koTaxonomy from "./ko/taxonomy.json";

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
  ko: [
    koPlatform,
    koApprovals,
    koTaxonomy,
    koLifecycle,
    koNotifications,
    koReceipts,
    koDiscovery,
  ],
};

const BASE_MESSAGES: Record<Locale, Messages> = { en: enBase, ko: koBase };

const cache = new Map<Locale, Messages>();

export function getAllMessages(locale: Locale): Messages {
  const cached = cache.get(locale);
  if (cached) return cached;
  // Korean falls back to English for namespaces not yet translated.
  const merged =
    locale === "ko"
      ? deepMergeMessages(
          BASE_MESSAGES.en,
          ...FEATURE_MESSAGES.en,
          BASE_MESSAGES.ko,
          ...FEATURE_MESSAGES.ko
        )
      : deepMergeMessages(BASE_MESSAGES.en, ...FEATURE_MESSAGES.en);
  cache.set(locale, merged);
  return merged;
}
