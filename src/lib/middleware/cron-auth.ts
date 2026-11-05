// src/lib/middleware/cron-auth.ts
/**
 * Cron endpoint authentication middleware
 *
 * Based on pattern C (verifyCronSecret) - the safest verification logic
 * Provides consistent CRON_SECRET verification for all cron endpoints.
 */

import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * Cron handler type
 */
export type CronHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * withCronAuth options
 */
export interface CronAuthOptions {
  /**
   * Whether to skip authentication in development
   * @default false (authentication is required in development too)
   *
   * Note: when true, development allows access without CRON_SECRET
   * false is recommended for security
   */
  skipInDevelopment?: boolean;
}

/**
 * HOF (higher-order function) that applies cron endpoint authentication
 *
 * Based on pattern C (verifyCronSecret) - the safest verification logic
 *
 * Verification order:
 * 1. Check the development skip option (optional)
 * 2. Check that the Authorization header exists
 * 3. Check that the CRON_SECRET environment variable is set
 * 4. Check that the Bearer token matches
 *
 * @example
 * ```typescript
 * // Default usage (strictest)
 * export const GET = withCronAuth(
 *   withLogging("cron:my-job", async (request) => {
 *     // Cron logic
 *     return NextResponse.json({ success: true });
 *   })
 * );
 *
 * // Skip in development (only when needed)
 * export const GET = withCronAuth(
 *   withLogging("cron:my-job", handler),
 *   { skipInDevelopment: true }
 * );
 * ```
 */
export function withCronAuth(
  handler: CronHandler,
  options: CronAuthOptions = {}
): CronHandler {
  const { skipInDevelopment = false } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    // 1. Development skip option (optional)
    if (skipInDevelopment && process.env.NODE_ENV === "development") {
      logger.debug("[CronAuth] Skipping auth in development");
      return handler(request);
    }

    // 2. Validate the Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      logger.warn("[CronAuth] Missing authorization header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Validate the CRON_SECRET environment variable
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      logger.error("[CronAuth] CRON_SECRET is not configured");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 4. Validate that the Bearer token matches
    if (authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("[CronAuth] Invalid cron secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 5. Authenticated - invoke the handler
    logger.debug("[CronAuth] Authentication successful");
    return handler(request);
  };
}
