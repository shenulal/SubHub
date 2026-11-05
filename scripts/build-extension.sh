#!/usr/bin/env bash
# scripts/build-extension.sh
# Chrome extension build script
#
# Usage:
#   ./scripts/build-extension.sh --env dev    # Build targeting the dev server
#   ./scripts/build-extension.sh --env local  # Build targeting the local server
#
# Prerequisites:
#   - A .env.local file must exist at the project root (DATABASE_URL, etc.)
#   - node and npm must be installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================================
# Parse arguments
# ============================================================
ENV_TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_TARGET="$2"
      shift 2
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Usage: $0 --env [dev|local]"
      exit 1
      ;;
  esac
done

if [[ -z "$ENV_TARGET" ]]; then
  echo "❌ The --env option is required (dev or local)"
  echo "Usage: $0 --env [dev|local]"
  exit 1
fi

# ============================================================
# Environment settings
# ============================================================
case "$ENV_TARGET" in
  dev)
    BUILD_API_URL="${BUILD_API_URL:-http://localhost:3000}"
    ;;
  local)
    BUILD_API_URL="http://localhost:3000"
    ;;
  *)
    echo "❌ Unsupported environment: $ENV_TARGET (only dev or local)"
    exit 1
    ;;
esac

echo "======================================================"
echo "  Chrome extension build script"
echo "  Environment: $ENV_TARGET | URL: $BUILD_API_URL"
echo "======================================================"
echo ""

# ============================================================
# Run the Node.js build (inline mjs script)
# ============================================================
cd "$PROJECT_ROOT"

node --input-type=module <<EOF
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { execFile } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { config } from "dotenv";
import { promisify } from "util";

// Load environment variables
config({ path: ".env.local" });

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);

const BUILD_API_URL = "${BUILD_API_URL}";
const EXTENSION_DIR = join(process.cwd(), "src", "extensions", "chrome");
const BUILD_SCRIPT = join(EXTENSION_DIR, "build.js");
const RELEASE_DIR = join(EXTENSION_DIR, "release");

// Token generation helper
function generateToken() {
  return randomBytes(32).toString("base64url");
}
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  // 1. Look up the current organisation
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    console.error("❌ Organisation not found. Check the database connection.");
    process.exit(1);
  }
  console.log("✅ Organisation:", org.name, "(id:", org.id + ")");

  // 2. Determine the build version (read from manifest.json)
  const manifestPath = join(EXTENSION_DIR, "manifest.json");
  const manifest = JSON.parse((await import("fs")).readFileSync(manifestPath, "utf-8"));
  const version = manifest.version;
  console.log("📦 Version:", version);

  // 3. Create or reuse the API token
  const rawToken = generateToken();
  const hashedToken = hashToken(rawToken);

  const buildLabel = "Build-Script-" + Date.now();
  const tokenRecord = await prisma.extensionApiToken.create({
    data: {
      organizationId: org.id,
      token: hashedToken,
      name: buildLabel,
      isActive: true,
    },
  });
  console.log("🔑 API token created:", tokenRecord.name);

  // 4. Create the ExtensionBuild record
  const build = await prisma.extensionBuild.create({
    data: {
      organizationId: org.id,
      version,
      platform: "CHROME",
      status: "BUILDING",
      serverUrl: BUILD_API_URL,
      buildLog: "[" + new Date().toISOString() + "] build-extension.sh build started\n",
    },
  });
  console.log("📋 Build record created (id:", build.id + ")");

  // 5. Run build.js
  console.log("");
  console.log("🔨 Starting webpack build...");

  let buildResult;
  try {
    const { stdout, stderr } = await execFileAsync(
      "node",
      [BUILD_SCRIPT, version],
      {
        cwd: EXTENSION_DIR,
        env: {
          ...process.env,
          NODE_ENV: "production",
          BUILD_API_URL,
          BUILD_API_CREDENTIAL: rawToken,
        },
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    try {
      buildResult = JSON.parse(stdout.trim());
    } catch {
      buildResult = { success: true, buildLog: stdout + stderr };
    }
  } catch (error) {
    // stdout may still contain the JSON result even if execFile reports an error
    try {
      buildResult = JSON.parse(error.stdout?.trim() || "{}");
    } catch {
      buildResult = {
        success: false,
        error: error.message,
        buildLog: (error.stdout || "") + (error.stderr || ""),
      };
    }
  }

  // 6. Update the database
  if (buildResult.success && buildResult.zipPath) {
    await prisma.extensionBuild.update({
      where: { id: build.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        buildLog: buildResult.buildLog,
        fileSize: buildResult.fileSize,
        checksum: buildResult.checksum,
        downloadUrl: "/api/v1/extensions/builds/" + build.id + "/download",
      },
    });

    console.log("");
    console.log("✅ Build succeeded!");
    console.log("   ZIP path:", buildResult.zipPath);
    console.log("   File size:", (buildResult.fileSize / 1024).toFixed(2), "KB");
    console.log("   Checksum:", buildResult.checksum);
    console.log("");
    console.log("🔗 Download URL:");
    console.log("   " + BUILD_API_URL + "/api/v1/extensions/builds/" + build.id + "/download");
    console.log("");
    console.log("💡 Refresh the Extensions → Builds page in SubHub.");
  } else {
    await prisma.extensionBuild.update({
      where: { id: build.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        buildLog: buildResult.buildLog,
        errorMessage: buildResult.error || "Build failed",
      },
    });

    console.error("");
    console.error("❌ Build failed:", buildResult.error);
    console.error("Build log:");
    console.error(buildResult.buildLog);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("❌ Script error:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.\$disconnect());
EOF
