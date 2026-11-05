// src/app/api/v1/extensions/builds/[id]/download/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createReadStream, existsSync, readdirSync, statSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { join } from "path";

// Build file path
const EXTENSION_DIR = join(process.cwd(), "src", "extensions", "chrome");
const RELEASE_DIR = join(EXTENSION_DIR, "release");

/**
 * Find the zip file matching the version in the release directory
 * 1. Prefer an exact version match
 * 2. Fall back to the most recently modified zip
 */
function findZipFile(version: string): string | null {
  if (!existsSync(RELEASE_DIR)) {
    return null;
  }

  const files = readdirSync(RELEASE_DIR).filter((f) => f.endsWith(".zip"));
  if (files.length === 0) {
    return null;
  }

  // 1. Exact version match
  const exactMatch = `shade-extension-${version}.zip`;
  if (files.includes(exactMatch)) {
    return join(RELEASE_DIR, exactMatch);
  }

  // 2. Fall back to the most recently modified zip
  const sortedFiles = files
    .map((f) => ({ name: f, mtime: statSync(join(RELEASE_DIR, f)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  return join(RELEASE_DIR, sortedFiles[0].name);
}

/**
 * Trigger a build internally
 * Called when the status is COMPLETED but the zip is missing (e.g. lost on container restart)
 */
async function triggerBuild(
  buildId: string,
  version: string,
  organizationId: string,
  serverUrl: string
): Promise<boolean> {
  const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-123";
  try {
    const response = await fetch(
      `${serverUrl}/api/v1/extensions/builds/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": AUTH_SECRET,
        },
        body: JSON.stringify({ buildId, version, organizationId }),
      }
    );

    if (!response.ok) {
      logger.error(
        { status: response.status },
        "[Download API] Internal build trigger failed"
      );
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    logger.error({ err: error }, "[Download API] Internal build trigger error");
    return false;
  }
}

/**
 * GET /api/v1/extensions/builds/[id]/download
 * Download the built ZIP file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    if (!isSuperAdmin && !session.user.organizationId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch build info
    const build = await prisma.extensionBuild.findUnique({
      where: { id },
    });

    if (
      !build ||
      (!isSuperAdmin && build.organizationId !== session.user.organizationId)
    ) {
      return NextResponse.json({ error: "Build not found" }, { status: 404 });
    }

    // Build in progress
    if (build.status === "BUILDING") {
      return NextResponse.json(
        { message: "The build is in progress. Please try again shortly" },
        { status: 202 }
      );
    }

    if (build.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "The build has not completed" },
        { status: 400 }
      );
    }

    // Find the zip file (exact version match → latest zip)
    let zipPath = findZipFile(build.version);

    // Auto-trigger a build if the zip is missing (handles files lost on container restart)
    if (!zipPath) {
      logger.info(
        { buildId: id, version: build.version },
        "[Download API] Zip file missing → auto-triggering build"
      );

      // Internal self-call uses localhost (bypasses CloudFront/WAF)
      const serverUrl = `http://localhost:${process.env.PORT || 3000}`;

      const success = await triggerBuild(
        id,
        build.version,
        isSuperAdmin ? build.organizationId : session.user.organizationId!,
        serverUrl
      );

      if (!success) {
        return NextResponse.json(
          { error: "Failed to generate the build file" },
          { status: 500 }
        );
      }

      // Search again after the build
      zipPath = findZipFile(build.version);
      if (!zipPath) {
        return NextResponse.json(
          { error: "ZIP file not found even after the build completed" },
          { status: 500 }
        );
      }
    }

    const stats = statSync(zipPath);

    // Create the file stream
    const stream = createReadStream(zipPath);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    // Return the download response
    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="shade-extension-${build.version}.zip"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[Download API] Error");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Download failed" },
      { status: 500 }
    );
  }
}
