/**
 * Hyphen corporate card API service
 */
import { createAuthHeaders } from "./auth";
import {
  ApprovalRequest,
  ApprovalResponse,
  CardCredentials,
  HyphenApiError,
  HyphenApiResponse,
  PurchaseRequest,
  PurchaseResponse,
} from "./types";

const HYPHEN_API_BASE = "https://api.hyphen.im";

// API endpoints
const ENDPOINTS = {
  CARD_APPROVAL: "/in0007000559", // Approval history inquiry
  CARD_PURCHASE: "/in0007000561", // Purchase history inquiry
};

/**
 * Handles a Hyphen API response
 * @param response API response
 * @throws HyphenApiError on error
 */
function handleResponse<T>(response: HyphenApiResponse<T>): T {
  if (response.common.errYn === "Y") {
    throw new HyphenApiError(
      response.common.errCd || "UNKNOWN",
      response.common.errMsg || "An unknown error occurred",
      response.common
    );
  }
  return response.data;
}

/**
 * Fetches card approval history
 * @param request Query conditions
 * @param credentials Card company credentials
 */
export async function getCardApprovals(
  request: ApprovalRequest,
  credentials: CardCredentials
): Promise<ApprovalResponse> {
  const body = {
    ...credentials,
    ...request,
    // Strip hyphens from the card number
    cardNo:
      credentials.cardNo?.replace(/-/g, "") ||
      request.cardNo?.replace(/-/g, ""),
  };

  const headers = createAuthHeaders();

  const response = await fetch(`${HYPHEN_API_BASE}${ENDPOINTS.CARD_APPROVAL}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data: ApprovalResponse = await response.json();

  if (!response.ok) {
    throw new HyphenApiError(
      "API_REQUEST_FAILED",
      `Approval history request failed: ${response.status} ${response.statusText}`
    );
  }

  // Error check
  handleResponse(data);

  return data;
}

/**
 * Fetches card purchase history
 * @param request Query conditions
 * @param credentials Card company credentials
 */
export async function getCardPurchases(
  request: PurchaseRequest,
  credentials: CardCredentials
): Promise<PurchaseResponse> {
  const body = {
    ...credentials,
    ...request,
    // Strip hyphens from the card number
    cardNo:
      credentials.cardNo?.replace(/-/g, "") ||
      request.cardNo?.replace(/-/g, ""),
  };

  const headers = createAuthHeaders();

  const response = await fetch(`${HYPHEN_API_BASE}${ENDPOINTS.CARD_PURCHASE}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data: PurchaseResponse = await response.json();

  if (!response.ok) {
    throw new HyphenApiError(
      "API_REQUEST_FAILED",
      `Purchase history request failed: ${response.status} ${response.statusText}`
    );
  }

  // Error check
  handleResponse(data);

  return data;
}

/**
 * Builds a date string (YYYYMMDD)
 * @param date Date object
 */
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Returns the period from the start of this month to today
 */
export function getCurrentMonthRange(): { sdate: string; edate: string } {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    sdate: formatDateYYYYMMDD(startOfMonth),
    edate: formatDateYYYYMMDD(now),
  };
}

/**
 * Returns the period covering the last N days
 * @param days Number of days
 */
export function getLastNDaysRange(days: number): {
  sdate: string;
  edate: string;
} {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  return {
    sdate: formatDateYYYYMMDD(startDate),
    edate: formatDateYYYYMMDD(now),
  };
}

/**
 * API call wrapper with retry logic
 * @param operation API call to execute
 * @param maxRetries Maximum number of retries
 * @param delayMs Delay between retries
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Retry only for retryable HyphenApiError codes
      if (error instanceof HyphenApiError) {
        const retryableCodes = ["TIMEOUT", "API_REQUEST_FAILED"];
        if (!retryableCodes.includes(error.code)) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        await delay(delayMs * attempt); // Linear backoff
      }
    }
  }

  throw lastError || new Error("Unknown error");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
