// src/app/api/v1/extensions/builds/execute/route.ts
/**
 * Chrome Extension build execution API
 * Split into an API route because Server Actions cannot use child_process
 *
 * Automatically generates organization API credentials at build time and injects them into the extension
 */

import { generateToken, hashToken } from "@/lib/api/extension-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { execFile } from "child_process";
import { NextRequest, NextResponse } from "next/server";

interface BuildResult {
  success: boolean;
  zipPath?: string;
  checksum?: string;
  fileSize?: number;
  error?: string;
  buildLog: string;
}

interface BuildEnvVars {
  BUILD_API_URL: string;
  BUILD_API_CREDENTIAL: string;
}

// Build the path in a function to avoid Turbopack static analysis
function getExtensionDir(): string {
  return [process.cwd(), "src", "extensions", "chrome"].join("/");
}

function getBuildScript(): string {
  return [getExtensionDir(), "build.js"].join("/");
}

/**
 * Create organization Extension API credentials or reuse existing ones
 */
async function getOrCreateBuildCredential(
  organizationId: string,
  buildId: string
): Promise<{ rawValue: string; credentialId: string }> {
  // Find existing build credentials
  const existingCredential = await prisma.extensionApiToken.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: { startsWith: "Build-" },
    },
  });

  if (existingCredential) {
    // If credentials exist, generate new values (the original cannot be recovered from the stored hash)
    // Generate new credentials
  }

  // Generate new credentials
  const rawValue = generateToken();
  const hashedValue = hashToken(rawValue);

  const credential = await prisma.extensionApiToken.create({
    data: {
      organizationId,
      token: hashedValue,
      name: `Build-${buildId}`,
      isActive: true,
    },
  });

  return { rawValue, credentialId: credential.id };
}

/**
 * Run the Chrome Extension build
 * Runs safely using execFile
 * Passes the API URL and credentials via environment variables
 */
async function executeBuild(
  version: string,
  envVars: BuildEnvVars
): Promise<BuildResult> {
  return new Promise((resolve) => {
    const extensionDir = getExtensionDir();
    const buildScript = getBuildScript();

    execFile(
      "node",
      [buildScript, version],
      {
        cwd: extensionDir,
        env: {
          ...process.env,
          NODE_ENV: "production",
          BUILD_API_URL: envVars.BUILD_API_URL,
          BUILD_API_CREDENTIAL: envVars.BUILD_API_CREDENTIAL,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      },
      (error, stdout, stderr) => {
        if (error) {
          // stdout may contain a JSON result even when there is an error
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch {
            resolve({
              success: false,
              error: error.message,
              buildLog: stdout + stderr,
            });
          }
          return;
        }

        // Normal exit
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch {
          resolve({
            success: true,
            buildLog: stdout + stderr,
          });
        }
      }
    );
  });
}

/**
 * POST /api/v1/extensions/builds/execute
 * Build execution request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buildId, version } = body;

    if (!buildId || !version) {
      return NextResponse.json(
        { success: false, error: "buildId and version are required" },
        { status: 400 }
      );
    }

    // Auth: internal secret or session
    let organizationId: string;
    const internalSecret = request.headers.get("x-internal-secret");
    const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-123";

    if (internalSecret && internalSecret === AUTH_SECRET) {
      // Internal call - use organizationId from the body
      if (!body.organizationId) {
        return NextResponse.json(
          { success: false, error: "organizationId is required" },
          { status: 400 }
        );
      }
      organizationId = body.organizationId;
    } else {
      const session = await auth();
      if (!session?.user?.organizationId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }
      organizationId = session.user.organizationId;
    }

    // Check that the build exists
    const build = await prisma.extensionBuild.findUnique({
      where: { id: buildId },
    });

    if (!build || build.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: "Build not found" },
        { status: 404 }
      );
    }

    // Set status to BUILDING
    await prisma.extensionBuild.update({
      where: { id: buildId },
      data: { status: "BUILDING", buildLog: "Build started...\n" },
    });

    // Generate API credentials for the build
    const { rawValue } = await getOrCreateBuildCredential(
      organizationId,
      buildId
    );

    // Determine the server URL (from request headers or environment variables)
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const serverUrl = process.env.NEXTAUTH_URL || `${protocol}://${host}`;

    // Run the build (credentials passed via environment variables)
    const result = await executeBuild(version, {
      BUILD_API_URL: serverUrl,
      BUILD_API_CREDENTIAL: rawValue,
    });

    if (result.success && result.zipPath) {
      await prisma.extensionBuild.update({
        where: { id: buildId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          buildLog: result.buildLog,
          fileSize: result.fileSize,
          checksum: result.checksum,
          downloadUrl: `/api/v1/extensions/builds/${buildId}/download`,
        },
      });
    } else {
      await prisma.extensionBuild.update({
        where: { id: buildId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          buildLog: result.buildLog,
          errorMessage: result.error || "Build failed",
        },
      });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    logger.error(
      { err: error },
      "[POST /api/v1/extensions/builds/execute] Error"
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Build execution failed",
      },
      { status: 500 }
    );
  }
}
