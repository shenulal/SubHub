/**
 * SMP-204: Server-side Pending Action Store
 *
 * Hardened approval security for the AI Write Tool:
 * - Server-side storage (in-memory Map)
 * - TTL check (5 minutes)
 * - Discarded after a single use
 * - Tamper detection (params hash comparison)
 * - Permission check (organizationId + userId)
 */

import { createHash } from "crypto";

// ==================== Types ====================

interface StoredPendingAction {
  id: string;
  action: string;
  paramsHash: string;
  organizationId: string;
  userId: string;
  createdAt: number;
}

export type ValidateResult =
  | { valid: true }
  | { valid: false; error: string; status: number };

// ==================== Constants ====================

/** TTL: 5 minutes (milliseconds) */
const TTL_MS = 5 * 60 * 1000;

/** Expiry cleanup interval: 60 seconds */
const CLEANUP_INTERVAL_MS = 60 * 1000;

// ==================== Store ====================

const store = new Map<string, StoredPendingAction>();

// Periodic expiry cleanup
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, action] of store) {
      if (now - action.createdAt > TTL_MS) {
        store.delete(id);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // So it does not keep the Node.js process alive
  if (
    cleanupTimer &&
    typeof cleanupTimer === "object" &&
    "unref" in cleanupTimer
  ) {
    cleanupTimer.unref();
  }
}

// ==================== Public API ====================

/**
 * Creates a hash of the params object.
 * Detects tampering by comparing the params sent by the client with the stored params.
 */
export function hashParams(params: Record<string, unknown>): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return createHash("sha256").update(sorted).digest("hex");
}

/**
 * Saves a pending action in the server store.
 * Called from POST /api/ai/chat when the Write Tool returns pending_approval.
 */
export function storePendingAction(
  id: string,
  action: string,
  params: Record<string, unknown>,
  organizationId: string,
  userId: string
): void {
  startCleanup();

  store.set(id, {
    id,
    action,
    paramsHash: hashParams(params),
    organizationId,
    userId,
    createdAt: Date.now(),
  });
}

/**
 * Validates a pending action and, if valid, removes it from the store (single use).
 * Called from PUT /api/ai/write when an approval is executed.
 *
 * Checks:
 * 1. Existence (expired/unregistered)
 * 2. TTL exceeded
 * 3. organizationId + userId match
 * 4. params hash match (tamper detection)
 */
export function validateAndConsume(
  id: string,
  params: Record<string, unknown>,
  organizationId: string,
  userId: string
): ValidateResult {
  const stored = store.get(id);

  // 1. Existence
  if (!stored) {
    return {
      valid: false,
      error:
        "This approval request has expired or is invalid. Please submit the request again.",
      status: 400,
    };
  }

  // 2. TTL exceeded
  if (Date.now() - stored.createdAt > TTL_MS) {
    store.delete(id);
    return {
      valid: false,
      error:
        "The approval request has timed out. Please submit the request again.",
      status: 400,
    };
  }

  // 3. Permission check
  if (stored.organizationId !== organizationId || stored.userId !== userId) {
    return {
      valid: false,
      error:
        "Permission denied: you are not authorized to approve this request.",
      status: 403,
    };
  }

  // 4. Tamper detection
  const currentHash = hashParams(params);
  if (stored.paramsHash !== currentHash) {
    store.delete(id);
    return {
      valid: false,
      error:
        "The request content has been tampered with. Please submit the request again.",
      status: 400,
    };
  }

  // Checks passed -> consume once (delete)
  store.delete(id);
  return { valid: true };
}

/**
 * Returns the store size (for tests/debugging)
 */
export function getStoreSize(): number {
  return store.size;
}

/**
 * Clears the store (for tests)
 */
export function clearStore(): void {
  store.clear();
}
