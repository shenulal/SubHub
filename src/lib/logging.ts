import { logger } from "@/lib/logger";

/**
 * Unified logging wrapper (shared by API Routes and Server Actions)
 *
 * Wraps every backend function (API Route handler, Server Action) and
 * logs start/done/error in a consistent format.
 *
 * API Route: NextRequest/NextResponse auto-detected → method, path, status
 * Server Action: payload captured, ActionState result summarised, success:false → warn
 *
 * @example API Route
 * ```ts
 * export const GET = withLogging("GET /api/v1/apps", async (req) => {
 *   return NextResponse.json(data);
 * });
 * ```
 *
 * @example Server Action
 * ```ts
 * async function _createApp(prevState, formData) { ... }
 * export const createApp = withLogging("createApp", _createApp);
 * ```
 */

// ─── Helpers ───

/** Extract query params from the URL → { page: "1", limit: "20" } */
function extractQueryParams(url: string): Record<string, string> | undefined {
  try {
    const { searchParams } = new URL(url);
    if (searchParams.size === 0) return undefined;
    const params: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      params[k] = v;
    });
    return params;
  } catch {
    return undefined;
  }
}

/** Extract the HTTP request body (clone → json; POST/PUT/PATCH/DELETE only) */
async function extractRequestBody(req: unknown): Promise<unknown> {
  if (!req || typeof req !== "object") return undefined;
  const r = req as {
    clone?: () => { json(): Promise<unknown> };
    method?: string;
  };
  if (typeof r.clone !== "function") return undefined;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(r.method ?? ""))
    return undefined;
  try {
    const cloned = r.clone();
    return await cloned.json();
  } catch {
    return undefined;
  }
}

/** Summarise large arrays in the response body as "[Array: N items]" */
function summarizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;

  const obj = { ...(body as Record<string, unknown>) };
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      obj[key] = `[Array: ${value.length} items]`;
    }
  }
  return obj;
}

/** Extract the HTTP response body (clone → json → summarise arrays) */
async function extractResponseBody(res: unknown): Promise<unknown> {
  if (!res || typeof res !== "object") return undefined;
  const r = res as { clone?: () => { json(): Promise<unknown> } };
  if (typeof r.clone !== "function") return undefined;
  try {
    const cloned = r.clone();
    const body = await cloned.json();
    return summarizeBody(body);
  } catch {
    return undefined;
  }
}

/** Convert FormData to a plain object (supports multiple values; File metadata only) */
function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  fd.forEach((value, key) => {
    if (key in obj) {
      const existing = obj[key];
      obj[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      obj[key] =
        value instanceof File ? `[File: ${value.name}, ${value.size}B]` : value;
    }
  });
  return obj;
}

/** Detect an HTTP request object (NextRequest-like) */
function isHttpRequest(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === "object" &&
    "method" in (val as Record<string, unknown>) &&
    "url" in (val as Record<string, unknown>)
  );
}

/** Detect an ActionState ({ success: boolean } pattern) */
function isActionState(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === "object" &&
    "success" in (val as Record<string, unknown>) &&
    typeof (val as Record<string, unknown>).success === "boolean"
  );
}

/**
 * Extract the payload to log from args
 * - excludes prevState (ActionState)
 * - excludes NextRequest
 * - converts FormData to a plain object
 */
function sanitizeArgs(args: unknown[]): unknown {
  if (args.length === 0) return undefined;

  const sanitized = args
    .filter((arg) => !isActionState(arg) && !isHttpRequest(arg))
    .map((arg) =>
      typeof FormData !== "undefined" && arg instanceof FormData
        ? formDataToObject(arg)
        : arg
    );

  if (sanitized.length === 0) return undefined;
  return sanitized.length === 1 ? sanitized[0] : sanitized;
}

/**
 * Summarise an ActionState result
 * - omits the data field (size concerns) → shows hasData: true only
 * - includes success, message, error, errors
 */
function summarizeResult(result: unknown): Record<string, unknown> | undefined {
  if (!result || typeof result !== "object") return undefined;

  const r = result as Record<string, unknown>;
  if (!("success" in r) || typeof r.success !== "boolean") return undefined;

  const summary: Record<string, unknown> = { success: r.success };
  if (r.message) summary.message = r.message;
  if (r.error) summary.error = r.error;
  if (r.errors) summary.errors = r.errors;
  if (r.data !== undefined) {
    summary.data = Array.isArray(r.data)
      ? `[Array: ${r.data.length} items]`
      : r.data;
  }
  return summary;
}

/**
 * Normalise an error object for logging
 * - PrismaClientKnownRequestError: strips mangled source code, keeps only the key details
 * - other errors: returned as-is
 */
function sanitizeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;

  const e = error as Error & {
    code?: string;
    meta?: Record<string, unknown>;
    clientVersion?: string;
  };

  // Detect Prisma errors: has a code field starting with "P"
  if (typeof e.code === "string" && e.code.startsWith("P")) {
    // Keep only the actual error text from message (strip source snippets and mangled paths)
    const lines = e.message.split("\n").filter((l) => l.trim());
    const meaningfulLine =
      lines.findLast(
        (l) =>
          !l.includes("TURBOPACK") &&
          !l.includes("__imported__module__") &&
          !l.includes("invocation in") &&
          !l.includes(".js:") &&
          !l.includes("// ") &&
          !l.includes("→ ") &&
          !/^\s*\d+\s/.test(l) &&
          l.trim().length > 0
      ) ?? lines[lines.length - 1];

    return {
      type: e.name,
      code: e.code,
      message: meaningfulLine?.trim(),
      meta: e.meta,
    };
  }

  // Other errors use Pino's default serialisation
  return error;
}

/** Detect Next.js redirect/notFound errors */
function isNextRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const digest = (error as { digest?: string }).digest;
  return (
    typeof digest === "string" &&
    (digest.includes("NEXT_REDIRECT") || digest.includes("NEXT_NOT_FOUND"))
  );
}

// ─── withLogging ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withLogging<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const start = Date.now();

    // Auto-detect NextRequest → extract method, path
    const req = args[0];
    const isHttp = isHttpRequest(req);
    const method = isHttp ? (req as { method: string }).method : undefined;
    const path = isHttp
      ? new URL((req as { url: string }).url).pathname
      : undefined;

    // HTTP → extract query params and request body
    const query = isHttp
      ? extractQueryParams((req as { url: string }).url)
      : undefined;
    const body = isHttp ? await extractRequestBody(req) : undefined;

    // Server Action → extract payload
    const payload = !isHttp ? sanitizeArgs(args as unknown[]) : undefined;

    logger.info({ name, method, path, query, body, payload }, "start");

    try {
      const result = await fn(...args);
      const durationMs = Date.now() - start;

      // Auto-detect NextResponse → extract status
      const status =
        result && typeof result === "object" && "status" in result
          ? (result as { status: number }).status
          : undefined;

      // HTTP → extract response body (arrays summarised automatically)
      const responseBody = isHttp
        ? await extractResponseBody(result)
        : undefined;

      // Summarise ActionState result
      const resultSummary = summarizeResult(result);

      // Decide the log level:
      // HTTP 4xx/5xx → warn
      // ActionState success:false → warn
      const isHttpError = status !== undefined && status >= 400;
      const isActionError = resultSummary?.success === false;

      const logData = {
        name,
        durationMs,
        status,
        method,
        path,
        ...(responseBody !== undefined ? { responseBody } : {}),
        ...(resultSummary ? { result: resultSummary } : {}),
      };

      if (isHttpError || isActionError) {
        logger.warn(logData, "done");
      } else {
        logger.info(logData, "done");
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - start;

      // Next.js redirects are normal flow → not logged as errors
      if (isNextRedirectError(error)) {
        logger.info({ name, durationMs, method, path }, "redirect");
        throw error;
      }

      logger.error(
        { name, durationMs, err: sanitizeError(error), method, path, payload },
        "fail"
      );

      throw error;
    }
  }) as unknown as T;
}
