/**
 * Hyphen OAuth token management
 */
import { HyphenApiError, OAuthTokenResponse } from "./types";

const HYPHEN_API_BASE = "https://api.hyphen.im";

/** Token cache */
interface TokenCache {
  accessToken: string;
  expiresAt: Date;
}

let tokenCache: TokenCache | null = null;

/**
 * Issues/returns the Hyphen access token
 * - Reuses the cached token while it is valid
 * - Refreshes it 1 hour before expiry
 */
export async function getHyphenAccessToken(): Promise<string> {
  // Return the cached token if still valid
  if (tokenCache && tokenCache.expiresAt > new Date()) {
    return tokenCache.accessToken;
  }

  // Check environment variables
  const userId = process.env.HYPHEN_USER_ID;
  const hkey = process.env.HYPHEN_HKEY;

  if (!userId || !hkey) {
    throw new HyphenApiError(
      "AUTH_CONFIG_ERROR",
      "HYPHEN_USER_ID or HYPHEN_HKEY environment variable is not set"
    );
  }

  // Issue the token
  const response = await fetch(`${HYPHEN_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      hkey: hkey,
    }),
  });

  if (!response.ok) {
    throw new HyphenApiError(
      "AUTH_FAILED",
      `Hyphen token request failed: ${response.status} ${response.statusText}`
    );
  }

  const data: OAuthTokenResponse = await response.json();

  if (!data.access_token) {
    throw new HyphenApiError(
      "AUTH_FAILED",
      "Hyphen token response does not contain an access_token"
    );
  }

  // Cache the token (valid until 1 hour before expiry)
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in - 3600) * 1000),
  };

  return tokenCache.accessToken;
}

/**
 * Clears the token cache (for tests)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}

/**
 * Builds auth headers (for the card API)
 * @description Uses only the User-Id and Hkey headers (no Bearer token required)
 */
export function createAuthHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Id": process.env.HYPHEN_USER_ID || "",
    Hkey: process.env.HYPHEN_HKEY || "",
    "Hyphen-Gustation": "Y",
  };
}

/**
 * Builds direct auth headers (user-id and Hkey, no token)
 */
export function createDirectAuthHeaders(): Record<string, string> {
  const userId = process.env.HYPHEN_USER_ID;
  const hkey = process.env.HYPHEN_HKEY;

  if (!userId || !hkey) {
    throw new HyphenApiError(
      "AUTH_CONFIG_ERROR",
      "HYPHEN_USER_ID or HYPHEN_HKEY environment variable is not set"
    );
  }

  return {
    "Content-Type": "application/json",
    "user-id": userId,
    Hkey: hkey,
  };
}
