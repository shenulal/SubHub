import type { Instrumentation } from "next";

export const runtime = "nodejs";

/**
 * Startup hook: validates configuration that must never fall back silently.
 * An invalid SUBHUB_DEPLOYMENT_MODE stops the server with a clear error.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { assertDeploymentModeConfigured } =
    await import("@/lib/deployment/mode");
  const mode = assertDeploymentModeConfigured();
  const { logger } = await import("@/lib/logger");
  logger.info({ deploymentMode: mode }, "SubHub deployment mode");
}

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
