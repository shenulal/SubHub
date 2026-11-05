// src/lib/services/hibp/breach-checker.ts
/**
 * Have I Been Pwned (HIBP) Breach Checker
 * k-anonymity-based password breach check
 *
 * The HIBP API is queried with the first 5 characters (prefix) of a SHA-1 hash and
 * returns the suffixes and breach counts of all hashes starting with that prefix.
 */

import crypto from "crypto";

const HIBP_API_URL = "https://api.pwnedpasswords.com/range";

export type HIBPCheckResult = {
  checked: boolean;
  breached: boolean;
  count?: number;
  error?: string;
};

/**
 * Converts a SHA-512 hash to SHA-1
 * The HIBP API only supports SHA-1 hashes, so a conversion is required.
 *
 * Note: ideally SHA-1 would be computed from the original password, but
 * the extension only sends an already SHA-512-hashed value, so
 * the SHA-512 hash is hashed again with SHA-1.
 * This is not perfect from a security standpoint, but it is the trade-off for never sending the original password to the server.
 */
function sha512ToSha1(sha512Hash: string): string {
  return crypto
    .createHash("sha1")
    .update(sha512Hash, "hex")
    .digest("hex")
    .toUpperCase();
}

/**
 * Checks HIBP for a breach using the password hash
 *
 * @param hashSha512 - SHA-512-hashed password
 * @returns HIBP check result
 */
export async function checkCredentialHIBP(
  hashSha512: string
): Promise<HIBPCheckResult> {
  try {
    // SHA-512 → SHA-1 conversion
    const sha1Hash = sha512ToSha1(hashSha512);

    // k-anonymity: range query with the first 5 characters
    const prefix = sha1Hash.substring(0, 5);
    const suffix = sha1Hash.substring(5);

    // Call the HIBP API
    const response = await fetch(`${HIBP_API_URL}/${prefix}`, {
      headers: {
        "User-Agent": "SMP-Extension-Checker",
        "Add-Padding": "true", // Padding for additional privacy
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          checked: false,
          breached: false,
          error: "Rate limited by HIBP API",
        };
      }
      return {
        checked: false,
        breached: false,
        error: `HIBP API error: ${response.status}`,
      };
    }

    const text = await response.text();

    // Parse the response: lines in "SUFFIX:COUNT" format
    const lines = text.split("\n");
    for (const line of lines) {
      const parts = line.split(":");
      if (parts.length !== 2) continue;

      const [hashSuffix, countStr] = parts;
      if (hashSuffix.trim().toUpperCase() === suffix) {
        const count = parseInt(countStr.trim(), 10);
        return {
          checked: true,
          breached: true,
          count,
        };
      }
    }

    // No matching hash means not breached
    return {
      checked: true,
      breached: false,
    };
  } catch (error) {
    console.error("HIBP check error:", error);
    return {
      checked: false,
      breached: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Hashes a string with SHA-1 (for tests)
 */
export function hashSha1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").toUpperCase();
}

/**
 * Hashes a string with SHA-512
 */
export function hashSha512(input: string): string {
  return crypto.createHash("sha512").update(input).digest("hex");
}
