#!/usr/bin/env node
/**
 * Chrome extension build script
 * Runs directly with Node.js (separate from the Next.js bundle)
 *
 * Usage: node src/extensions/chrome/build.js <version>
 */

const webpack = require("webpack");
const archiver = require("archiver");
const {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} = require("fs");
const { createHash } = require("crypto");
const { join } = require("path");

// Paths
const EXTENSION_DIR = __dirname;
const DIST_DIR = join(EXTENSION_DIR, "dist");
const RELEASE_DIR = join(EXTENSION_DIR, "release");

/**
 * Create the webpack config
 * Embeds BUILD_API_URL and BUILD_API_CREDENTIAL (passed as environment variables) into the bundle
 */
function createWebpackConfig() {
  const CopyPlugin = require("copy-webpack-plugin");

  // Read build-time values from environment variables
  const buildApiUrl = process.env.BUILD_API_URL || "http://localhost:3000";
  const buildApiCredential = process.env.BUILD_API_CREDENTIAL || "";

  return {
    mode: "production",
    entry: {
      background: join(EXTENSION_DIR, "src", "background", "index.ts"),
      content: join(EXTENSION_DIR, "src", "content", "index.ts"),
      popup: join(EXTENSION_DIR, "src", "popup", "index.ts"),
      onboarding: join(EXTENSION_DIR, "src", "onboarding", "onboarding.ts"),
    },
    output: {
      path: DIST_DIR,
      filename: "[name].js",
    },
    resolve: {
      extensions: [".ts", ".js"],
      fallback: {
        crypto: false,
        buffer: false,
        stream: false,
        path: false,
        vm: false,
        fs: false,
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: "ts-loader",
            options: {
              configFile: join(EXTENSION_DIR, "tsconfig.json"),
            },
          },
          exclude: [/node_modules/, /\.test\.ts$/],
        },
      ],
    },
    devtool: "source-map",
    optimization: {
      minimize: true,
    },
    plugins: [
      // Inject as global constants at build time (direct replacement, no runtime conditionals)
      new webpack.DefinePlugin({
        __BUILD_API_URL__: JSON.stringify(buildApiUrl),
        __BUILD_API_CREDENTIAL__: JSON.stringify(buildApiCredential),
      }),
      new CopyPlugin({
        patterns: [
          { from: join(EXTENSION_DIR, "manifest.json"), to: "." },
          { from: join(EXTENSION_DIR, "public"), to: "." },
          {
            from: join(EXTENSION_DIR, "src", "popup", "popup.html"),
            to: "popup.html",
          },
          {
            from: join(EXTENSION_DIR, "src", "onboarding", "onboarding.html"),
            to: "onboarding.html",
          },
          {
            from: join(EXTENSION_DIR, "policy_templates"),
            to: "policy_templates",
          },
        ],
      }),
    ],
  };
}

/**
 * Run the webpack compilation
 */
function runWebpackBuild() {
  return new Promise((resolve) => {
    const config = createWebpackConfig();
    const compiler = webpack(config);

    compiler.run((err, stats) => {
      compiler.close(() => {});

      if (err) {
        resolve({ success: false, log: "", error: err.message });
        return;
      }

      const log = stats?.toString({ colors: false }) || "";

      if (stats?.hasErrors()) {
        const info = stats.toJson();
        resolve({
          success: false,
          log,
          error:
            info?.errors?.map((e) => e.message).join("\n") || "Build failed",
        });
        return;
      }

      resolve({ success: true, log });
    });
  });
}

/**
 * Create the ZIP file
 */
function createZip(version) {
  if (!existsSync(RELEASE_DIR)) {
    mkdirSync(RELEASE_DIR, { recursive: true });
  }

  const zipFileName = `shade-extension-${version}.zip`;
  const zipPath = join(RELEASE_DIR, zipFileName);

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      const stats = statSync(zipPath);
      const fileBuffer = readFileSync(zipPath);
      const checksum = createHash("sha256").update(fileBuffer).digest("hex");

      resolve({ zipPath, checksum, fileSize: stats.size });
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);
    archive.directory(DIST_DIR, false);
    archive.finalize();
  });
}

/**
 * Main function
 */
async function main() {
  const version = process.argv[2] || "1.0.0";

  const result = {
    success: false,
    buildLog: `[${new Date().toISOString()}] Build started (version: ${version})\n`,
  };

  // Update the manifest.json version (before building)
  const manifestPath = join(EXTENSION_DIR, "manifest.json");
  const originalManifest = readFileSync(manifestPath, "utf-8");

  let exitCode = 1;

  try {
    // 1. Replace the manifest.json version field with the build version
    const manifest = JSON.parse(originalManifest);
    manifest.version = version;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    result.buildLog += `[manifest] version updated to "${version}"\n`;

    // 2. webpack build
    result.buildLog += "\n[webpack] Compilation started...\n";
    const webpackResult = await runWebpackBuild();
    result.buildLog += webpackResult.log + "\n";

    if (!webpackResult.success) {
      result.error = webpackResult.error || "webpack build failed";
      result.buildLog += `\n[ERROR] ${webpackResult.error}`;
    } else {
      result.buildLog += "[webpack] Compilation complete\n";

      // 3. Create the ZIP
      result.buildLog += "\n[archiver] Creating ZIP file...\n";
      const zipResult = await createZip(version);
      result.buildLog += `[archiver] ZIP created: ${zipResult.zipPath}\n`;
      result.buildLog += `[archiver] File size: ${(zipResult.fileSize / 1024).toFixed(2)} KB\n`;
      result.buildLog += `[archiver] Checksum: ${zipResult.checksum}\n`;
      result.buildLog += `\n[${new Date().toISOString()}] Build complete!\n`;

      result.success = true;
      result.zipPath = zipResult.zipPath;
      result.checksum = zipResult.checksum;
      result.fileSize = zipResult.fileSize;
      exitCode = 0;
    }
  } catch (error) {
    result.error = error.message || "Unknown error";
    result.buildLog += `\n[ERROR] ${result.error}\n`;
  } finally {
    // Restore the original manifest.json (keeps the source clean)
    writeFileSync(manifestPath, originalManifest);
    result.buildLog += `[manifest] Original restored\n`;
  }

  console.log(JSON.stringify(result));
  process.exit(exitCode);
}

main();
