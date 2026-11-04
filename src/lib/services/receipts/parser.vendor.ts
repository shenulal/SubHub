// src/lib/services/receipts/parser.vendor.ts
/**
 * Vendor-name extraction from sender, subject and known catalog aliases.
 */
import {
  DISPLAY_NAME_NOISE,
  DOMAIN_PREFIX_NOISE,
  GENERIC_LOCAL_PARTS,
  PAYMENT_PROCESSOR_DOMAINS,
  PUBLIC_MAILBOX_DOMAINS,
} from "./parser.constants";

export interface KnownVendor {
  id: string;
  name: string;
  aliases: string[];
  website: string | null;
}

export interface SenderInfo {
  displayName: string | null;
  email: string | null;
  domain: string | null;
  isProcessor: boolean;
  isPublicMailbox: boolean;
}

export interface VendorResult {
  name: string | null;
  domain: string | null;
  knownVendorId: string | null;
}

const SUBJECT_PATTERNS: RegExp[] = [
  /(?:receipt|invoice)\s+(?:from|for)\s+(.+?)(?:\s*[-–|#(:]|$)/i,
  /payment\s+to\s+(.+?)(?:\s*[-–|#(:]|$)/i,
  /thanks?\s+for\s+(?:your\s+)?(?:payment\s+to|purchase\s+from|subscribing\s+to)\s+(.+?)(?:[.!]|$)/i,
  /(.+?)\s+subscription\s+(?:renewed|renewal|confirmed|receipt)/i,
  /^(?:your\s+)?(.+?)\s+(?:receipt|invoice|subscription|payment|renewal|order)\b/i,
  /^(.+?)\s*[:\-–|]\s*(?:your\s+)?(?:receipt|invoice|payment|renewal|subscription)/i,
];

const STOP_WORDS = new Set([
  "your",
  "the",
  "a",
  "an",
  "this",
  "my",
  "our",
  "you",
]);

const NOISE_WORDS = new Set<string>(DISPLAY_NAME_NOISE);

export function parseSender(from: string): SenderInfo {
  const trimmed = from.trim();
  const angle = /^(.*?)<([^>]+)>\s*$/.exec(trimmed);
  const rawName = angle ? angle[1] : "";
  const email = (angle ? angle[2] : trimmed).trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const domain = isEmail ? email.split("@")[1] : null;
  const displayName =
    rawName
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .trim() || null;
  const registered = domain ? registeredDomain(domain) : null;

  return {
    displayName,
    email: isEmail ? email : null,
    domain,
    isProcessor:
      !!registered &&
      (PAYMENT_PROCESSOR_DOMAINS as readonly string[]).includes(registered),
    isPublicMailbox:
      !!registered &&
      (PUBLIC_MAILBOX_DOMAINS as readonly string[]).includes(registered),
  };
}

/** `mail.notifications.example.co.uk` → `example.co.uk` (best-effort). */
export function registeredDomain(domain: string): string {
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const secondLevelTlds = ["co", "com", "org", "net", "gov", "ac", "edu"];
  const tail = parts.slice(-2);
  const usesSecondLevel =
    tail[0].length <= 3 &&
    secondLevelTlds.includes(tail[0]) &&
    tail[1].length === 2;
  return parts.slice(usesSecondLevel ? -3 : -2).join(".");
}

export function vendorFromDomain(domain: string): string | null {
  const registered = registeredDomain(domain);
  const label = registered.split(".")[0];
  if (!label || (DOMAIN_PREFIX_NOISE as readonly string[]).includes(label))
    return null;
  return capitalise(label);
}

export function cleanDisplayName(name: string): string | null {
  const stripped = name
    .replace(/\(.*?\)/g, " ")
    .replace(/[|•·,]+/g, " ")
    .replace(/\s+via\s+.*$/i, "")
    .replace(/<.*$/, "");
  const words = stripped
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w.toLowerCase()));
  const result = words.join(" ").trim();
  if (!result || /^[^a-z0-9]+$/i.test(result)) return null;
  if (/@/.test(result)) return null;
  return result;
}

export function vendorFromSubject(subject: string): string | null {
  for (const pattern of SUBJECT_PATTERNS) {
    const match = pattern.exec(subject);
    if (!match) continue;
    const candidate = cleanDisplayName(match[1].replace(/^(your|the)\s+/i, ""));
    if (!candidate) continue;
    if (candidate.split(/\s+/).length > 5) continue;
    if (STOP_WORDS.has(candidate.toLowerCase())) continue;
    if (
      /^(?:payment|receipt|invoice|order|renewal|subscription)$/i.test(
        candidate
      )
    )
      continue;
    return candidate;
  }
  return null;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Match sender domain / display name / subject against the catalog aliases.
 */
export function matchKnownVendor(
  sender: SenderInfo,
  subject: string,
  known: KnownVendor[]
): KnownVendor | null {
  if (known.length === 0) return null;
  const senderRegistered = sender.domain
    ? registeredDomain(sender.domain)
    : null;
  const haystack = ` ${normalise(`${sender.displayName ?? ""} ${subject}`)} `;

  let best: KnownVendor | null = null;
  let bestLength = 0;
  for (const vendor of known) {
    if (senderRegistered && vendor.website && !sender.isProcessor) {
      const host = vendor.website.replace(/^https?:\/\//, "").split("/")[0];
      if (host && registeredDomain(host) === senderRegistered) return vendor;
    }
    for (const alias of [vendor.name, ...vendor.aliases]) {
      const needle = normalise(alias);
      if (needle.length < 3) continue;
      if (haystack.includes(` ${needle} `) && needle.length > bestLength) {
        best = vendor;
        bestLength = needle.length;
      }
    }
  }
  return best;
}

export function extractVendor(
  from: string,
  subject: string,
  known: KnownVendor[] = []
): VendorResult {
  const sender = parseSender(from);
  const domain = sender.domain ? registeredDomain(sender.domain) : null;
  const matched = matchKnownVendor(sender, subject, known);
  if (matched) {
    return { name: matched.name, domain, knownVendorId: matched.id };
  }

  const fromSubject = vendorFromSubject(subject);
  const fromDisplay = sender.displayName
    ? cleanDisplayName(sender.displayName)
    : null;
  const localPart = sender.email?.split("@")[0] ?? "";
  const genericLocal = (GENERIC_LOCAL_PARTS as readonly string[]).includes(
    localPart.toLowerCase()
  );

  if (sender.isProcessor || sender.isPublicMailbox) {
    const name = fromSubject ?? (sender.isPublicMailbox ? fromDisplay : null);
    return {
      name,
      domain: sender.isProcessor ? null : domain,
      knownVendorId: null,
    };
  }

  const fromDomain = sender.domain ? vendorFromDomain(sender.domain) : null;
  const name =
    fromDisplay ??
    fromSubject ??
    fromDomain ??
    (genericLocal ? null : capitalise(localPart) || null);
  return { name, domain, knownVendorId: null };
}
