// src/app/api/files/[...key]/route.ts
/**
 * Serves objects from the `local` storage provider. Requires a signed-in
 * session AND a valid HMAC signature issued by `getSignedUrl` (so a link can be
 * shared only for its TTL). Keys are sanitised against path traversal.
 */
import { auth } from "@/lib/auth";
import { withLogging } from "@/lib/logging";
import {
  createLocalProvider,
  verifyLocalSignature,
} from "@/lib/services/storage/local";
import { sanitizeKey, StorageKeyError } from "@/lib/services/storage/types";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string[] }> };

async function handler(request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const { key: segments } = await context.params;
  let key: string;
  try {
    key = sanitizeKey((segments ?? []).map(decodeURIComponent).join("/"));
  } catch (error) {
    const message =
      error instanceof StorageKeyError ? error.message : "Invalid key";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }

  const exp = Number(request.nextUrl.searchParams.get("exp"));
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  if (!verifyLocalSignature(key, exp, sig)) {
    return NextResponse.json(
      { success: false, error: "Link expired or invalid" },
      { status: 403 }
    );
  }

  const object = await createLocalProvider().getObject(key);
  if (!object) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }
  const filename = key.split("/").pop() ?? "download";
  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "content-type": object.contentType,
      "content-length": String(object.body.byteLength),
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}

export const GET = withLogging("GET /api/files", handler);
