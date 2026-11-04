import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.E2E_PORT ?? "3100";

/**
 * SubHub end-to-end smoke suite.
 * Expects a running app (npm run dev or npm start) on BASE_URL and a database
 * seeded with `npx tsx scripts/seed-smoke.ts`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "html/playwright" }],
  ],
  // Starts the production server (next start) unless BASE_URL points at a running app.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${E2E_PORT}`,
        url: `http://localhost:${E2E_PORT}/login`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: {
          ...process.env,
          NEXTAUTH_URL: `http://localhost:${E2E_PORT}`,
          NEXT_PUBLIC_APP_URL: `http://localhost:${E2E_PORT}`,
        },
      },
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
