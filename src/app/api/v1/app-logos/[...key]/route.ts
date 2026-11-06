// src/app/api/v1/app-logos/[...key]/route.ts
/**
 * GET /api/v1/app-logos/:orgId/:file — streams an uploaded app icon from the
 * storage provider (local disk or S3/R2). Signed-in members of that
 * organisation only (SUPER_ADMIN may view any). The bytes are re-checked on
 * the way out and served with a strict, non-executable content policy.
 */
import {
  withApiAuth,
  type AuthenticatedSession,
} from "@/lib/api/auth-middleware";
import { withLogging } from "@/lib/logging";
import {
  APP_LOGO_ROUTE,
  logoKeyFromSegments,
  sniffImageType,
} from "@/lib/services/app-logo";
import { getObject } from "@/lib/services/storage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Keys are random and never reused, so the browser may cache for a day. */
const CACHE_CONTROL = "private, max-age=86400, immutable";

function segmentsOf(request: NextRequest): string[] {
  const path = new URL(request.url).pathname;
  return path
    .slice(path.indexOf(APP_LOGO_ROUTE) + APP_LOGO_ROUTE.length + 1)
    .split("/")
    .map((s) => decodeURIComponent(s));
}

const notFound = () =>
  NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

export const GET = withApiAuth(
  withLogging(
    "GET /api/v1/app-logos",
    async (
      request: NextRequest,
      { session }: { session: AuthenticatedSession }
    ) => {
      const parsed = logoKeyFromSegments(segmentsOf(request));
      if (!parsed) return notFound();
      const isSuperAdmin = session.user.role === "SUPER_ADMIN";
      if (
        !isSuperAdmin &&
        parsed.organizationId !== session.user.organizationId
      ) {
        return notFound();
      }
      const object = await getObject(parsed.key);
      const type = object ? sniffImageType(object.body) : null;
      if (!object || !type) return notFound();
      return new NextResponse(new Uint8Array(object.body), {
        headers: {
          "content-type": type,
          "content-length": String(object.body.byteLength),
          "cache-control": CACHE_CONTROL,
          "content-disposition": "inline",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
        },
      });
    }
  )
);
