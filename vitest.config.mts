import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    // Test environment settings
    environment: "jsdom",
    globals: true,
    setupFiles: [
      "./src/extensions/chrome/src/test/setup.ts",
      "./vitest.setup.ts",
    ],

    // Test file patterns
    include: [
      "src/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "prisma/**/*.test.{ts,tsx}",
    ],
    exclude: [
      "node_modules",
      "packages/**",
      ".next",
      // TODO (v0.1.1): module-scope chrome.webNavigation call crashes test discovery
      "src/extensions/chrome/src/background/index.test.ts",
    ],

    // Coverage settings
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/**/index.ts",
        "src/app/layout.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
      ],
      // 80% coverage threshold
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Reporter settings
    reporters: ["default", "html"],

    // framer-motion ESM compatibility (so it works under jsdom). next-auth imports
    // "next/server" without an extension, which Node's resolver rejects; letting
    // Vite transform it fixes suites that reach the server auth config.
    server: {
      deps: {
        inline: ["framer-motion", "next-auth"],
      },
    },
  },

  // Path aliases (kept in sync with tsconfig.json)
  resolve: {
    alias: {
      // UI components come from the submodule
      "@/components/ui": path.resolve(
        __dirname,
        "./packages/ui-registry/src/components/ui"
      ),
      // hooks: project hooks first, falling back to the submodule
      "@/hooks/use-count-up": path.resolve(
        __dirname,
        "./src/hooks/use-count-up"
      ),
      "@/hooks/use-dismissed-alerts": path.resolve(
        __dirname,
        "./src/hooks/use-dismissed-alerts"
      ),
      // SubHub hooks live in src/hooks (registered before the ui-registry fallback)
      "@/hooks/use-permissions": path.resolve(
        __dirname,
        "./src/hooks/use-permissions"
      ),
      "@/hooks/use-permission-flag": path.resolve(
        __dirname,
        "./src/hooks/use-permission-flag"
      ),
      "@/hooks/use-base-currency": path.resolve(
        __dirname,
        "./src/hooks/use-base-currency"
      ),
      "@/hooks/use-workspace-scope": path.resolve(
        __dirname,
        "./src/hooks/use-workspace-scope"
      ),
      "@/hooks/use-element-size": path.resolve(
        __dirname,
        "./src/hooks/use-element-size"
      ),
      "@/hooks": path.resolve(__dirname, "./packages/ui-registry/src/hooks"),
      // lib/utils/renewal-date comes from src (registered before @/lib/utils)
      "@/lib/utils/renewal-date": path.resolve(
        __dirname,
        "./src/lib/utils/renewal-date"
      ),
      // lib/utils/domain-extractor comes from src (registered before @/lib/utils)
      "@/lib/utils/domain-extractor": path.resolve(
        __dirname,
        "./src/lib/utils/domain-extractor"
      ),
      // lib/utils comes from the submodule
      "@/lib/utils": path.resolve(
        __dirname,
        "./packages/ui-registry/src/lib/utils"
      ),
      // Everything else comes from src
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
