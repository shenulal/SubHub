import type { Instrumentation } from "next";

export const runtime = "nodejs";

/**
 * Next.js Instrumentation
 *
 * onRequestError hook: automatically captures every server error
 * - API Routes
 * - Server Actions
 * - SSR errors
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Dynamic import to avoid Edge Runtime issues
  const { logger } = await import("@/lib/logger");

  logger.error(
    {
      err,
      path: request.path,
      method: request.method,
      routeType: context.routeType,
      routePath: context.routePath,
    },
    "Unhandled request error"
  );
};
