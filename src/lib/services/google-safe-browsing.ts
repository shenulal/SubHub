// src/lib/services/google-safe-browsing.ts
/**
 * Google Safe Browsing API v4 client
 * @see https://developers.google.com/safe-browsing/v4
 */

const SAFE_BROWSING_API_URL =
  "https://safebrowsing.googleapis.com/v4/threatMatches:find";

/**
 * Threat types
 */
export type ThreatType =
  | "MALWARE"
  | "SOCIAL_ENGINEERING"
  | "UNWANTED_SOFTWARE"
  | "POTENTIALLY_HARMFUL_APPLICATION";

/**
 * Safe Browsing API check result
 */
export interface SafeBrowsingResult {
  isMalicious: boolean;
  threatType: ThreatType | null;
  platformType: string | null;
  threatEntryType: string | null;
}

/**
 * Safe Browsing API request format
 */
interface SafeBrowsingRequest {
  client: {
    clientId: string;
    clientVersion: string;
  };
  threatInfo: {
    threatTypes: ThreatType[];
    platformTypes: string[];
    threatEntryTypes: string[];
    threatEntries: { url: string }[];
  };
}

/**
 * Safe Browsing API response format
 */
interface SafeBrowsingResponse {
  matches?: {
    threatType: ThreatType;
    platformType: string;
    threatEntryType: string;
    threat: { url: string };
    cacheDuration: string;
  }[];
}

/**
 * Checks URL safety with the Google Safe Browsing API
 *
 * @param urls - URLs to check (up to 500)
 * @returns Map of results per URL
 *
 * @example
 * const results = await checkUrlSafety(["https://malware.testing.google.test/testing/malware/"]);
 * // Map { "https://malware.testing.google.test/testing/malware/" => { isMalicious: true, threatType: "MALWARE", ... } }
 */
export async function checkUrlSafety(
  urls: string[]
): Promise<Map<string, SafeBrowsingResult>> {
  const results = new Map<string, SafeBrowsingResult>();

  // Without an API key, treat all URLs as safe
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    console.warn(
      "[SafeBrowsing] API key not configured, skipping malware check"
    );
    for (const url of urls) {
      results.set(url, {
        isMalicious: false,
        threatType: null,
        platformType: null,
        threatEntryType: null,
      });
    }
    return results;
  }

  // Return an empty Map when there are no URLs
  if (urls.length === 0) {
    return results;
  }

  // API limit: up to 500 URLs
  const urlBatches = chunk(urls, 500);

  for (const batch of urlBatches) {
    try {
      const requestBody: SafeBrowsingRequest = {
        client: {
          clientId: "subhub",
          clientVersion: "1.0.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: batch.map((url) => ({ url })),
        },
      };

      const response = await fetch(`${SAFE_BROWSING_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error(
          "[SafeBrowsing] API error:",
          response.status,
          await response.text()
        );
        // On an API error, treat the batch's URLs as safe
        for (const url of batch) {
          results.set(url, {
            isMalicious: false,
            threatType: null,
            platformType: null,
            threatEntryType: null,
          });
        }
        continue;
      }

      const data: SafeBrowsingResponse = await response.json();

      // Default: mark all URLs as safe
      for (const url of batch) {
        results.set(url, {
          isMalicious: false,
          threatType: null,
          platformType: null,
          threatEntryType: null,
        });
      }

      // Update URLs where threats were found
      if (data.matches) {
        for (const match of data.matches) {
          results.set(match.threat.url, {
            isMalicious: true,
            threatType: match.threatType,
            platformType: match.platformType,
            threatEntryType: match.threatEntryType,
          });
        }
      }
    } catch (error) {
      console.error("[SafeBrowsing] Request failed:", error);
      // On a network error, treat the batch's URLs as safe
      for (const url of batch) {
        results.set(url, {
          isMalicious: false,
          threatType: null,
          platformType: null,
          threatEntryType: null,
        });
      }
    }
  }

  return results;
}

/**
 * Checks the safety of a single domain
 *
 * @param domain - Domain to check (e.g. "google.com")
 * @returns Check result
 */
export async function checkDomainSafety(
  domain: string
): Promise<SafeBrowsingResult> {
  const url = `https://${domain}/`;
  const results = await checkUrlSafety([url]);
  return (
    results.get(url) || {
      isMalicious: false,
      threatType: null,
      platformType: null,
      threatEntryType: null,
    }
  );
}

/**
 * Splits an array into chunks of the given size
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Display label for a threat type
 */
export function getThreatTypeLabel(threatType: ThreatType | null): string {
  switch (threatType) {
    case "MALWARE":
      return "Malware";
    case "SOCIAL_ENGINEERING":
      return "Phishing / social engineering";
    case "UNWANTED_SOFTWARE":
      return "Unwanted software";
    case "POTENTIALLY_HARMFUL_APPLICATION":
      return "Potentially harmful app";
    default:
      return "Unknown";
  }
}
