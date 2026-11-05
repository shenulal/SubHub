// src/app/(dashboard)/dashboard/phase2-demo-route-cleanup.test.ts
// Phase 2 RED: verify deletion of demo routes and unused components/actions
// - Files slated for deletion must not exist
// - All production files to keep must exist
// - Production code must not import modules slated for deletion

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

// ============================================================
// 1. Files to delete
// ============================================================

/** Demo route pages */
const DEMO_ROUTE_PAGES_TO_DELETE = [
  "src/app/(dashboard)/dashboard2/page.tsx",
  "src/app/(dashboard)/dashboard-v2-demo/page.tsx",
  "src/app/(dashboard)/dashboard-v2-cost/page.tsx",
  "src/app/(dashboard)/dashboard-v2-seat/page.tsx",
];

/** Delete all of dashboard-v2-demo (unused in production) */
const DASHBOARD_V2_DEMO_FILES_TO_DELETE = [
  "src/components/dashboard-v2-demo/index.ts",
  "src/components/dashboard-v2-demo/dashboard-v2-demo-client.tsx",
  "src/components/dashboard-v2-demo/cost-savings-hero.tsx",
  "src/components/dashboard-v2-demo/cost-trend-chart.tsx",
  "src/components/dashboard-v2-demo/kpi-card-grid.tsx",
  "src/components/dashboard-v2-demo/renewal-alerts-card.tsx",
  "src/components/dashboard-v2-demo/savings-opportunity-card.tsx",
  "src/components/dashboard-v2-demo/top-apps-table.tsx",
];

/** dashboard-v2-cost deletion targets (excluding 3 used in production) */
const DASHBOARD_V2_COST_FILES_TO_DELETE = [
  "src/components/dashboard-v2-cost/dashboard-v2-cost-client.tsx",
  "src/components/dashboard-v2-cost/cost-kpi-cards.tsx",
  "src/components/dashboard-v2-cost/optimization-hero.tsx",
  "src/components/dashboard-v2-cost/savings-breakdown.tsx",
];

/** dashboard-v2-seat deletion targets (excluding 1 used in production) */
const DASHBOARD_V2_SEAT_FILES_TO_DELETE = [
  "src/components/dashboard-v2-seat/dashboard-v2-seat-client.tsx",
  "src/components/dashboard-v2-seat/seat-kpi-cards.tsx",
  "src/components/dashboard-v2-seat/app-efficiency-matrix.tsx",
  "src/components/dashboard-v2-seat/optimization-actions.tsx",
];

/** dashboard2 component deletion targets (excluding 2 used in production) */
const DASHBOARD2_COMPONENT_FILES_TO_DELETE = [
  "src/components/dashboard2/dashboard2-page-client.tsx",
  "src/components/dashboard2/kpi-cards.tsx",
  "src/components/dashboard2/alerts-banner.tsx",
  "src/components/dashboard2/app-status-overview-card.tsx",
  "src/components/dashboard2/app-status-overview-card.test.tsx",
  "src/components/dashboard2/apps-table-with-tabs.tsx",
  "src/components/dashboard2/apps-table.utils.tsx",
  "src/components/dashboard2/detected-apps-table.tsx",
  "src/components/dashboard2/device-detected-apps-card.tsx",
  "src/components/dashboard2/license-efficiency-card.tsx",
  "src/components/dashboard2/monthly-spend-trend-chart.tsx",
  "src/components/dashboard2/onboarding-offboarding-card.tsx",
  "src/components/dashboard2/security-risk-overview-card.tsx",
  "src/components/dashboard2/shadow-it-table.tsx",
  "src/components/dashboard2/spend-by-category-card.tsx",
  "src/components/dashboard2/spend-by-category-card.test.tsx",
  "src/components/dashboard2/spending-apps-table.tsx",
  "src/components/dashboard2/top-spending-apps-table.tsx",
  "src/components/dashboard2/urgent-renewals-card.tsx",
  "src/components/dashboard2/user-overview-card.tsx",
  "src/components/dashboard2/users-vs-licenses-chart.tsx",
];

/** dashboard2 action deletion targets (dashboard2-seat, dashboard2-cost and dashboard2-renewals are kept because the AI read-tool uses them) */
const DASHBOARD2_ACTIONS_TO_DELETE = [
  "src/actions/dashboard2.ts",
  "src/actions/dashboard2-security.ts",
  "src/actions/dashboard2-summary.ts",
  "src/actions/dashboard2-users.ts",
  "src/actions/dashboard2-devices.ts",
];

const ALL_FILES_TO_DELETE = [
  ...DEMO_ROUTE_PAGES_TO_DELETE,
  ...DASHBOARD_V2_DEMO_FILES_TO_DELETE,
  ...DASHBOARD_V2_COST_FILES_TO_DELETE,
  ...DASHBOARD_V2_SEAT_FILES_TO_DELETE,
  ...DASHBOARD2_COMPONENT_FILES_TO_DELETE,
  ...DASHBOARD2_ACTIONS_TO_DELETE,
];

// ============================================================
// 2. Production files to keep
// ============================================================

const PRODUCTION_MUST_KEEP_FILES = [
  // After the Phase 3 consolidation: all components live in new-dashboard/
  "src/components/dashboard/new-dashboard-client.tsx",
  "src/components/dashboard/seat-utilization-chart.tsx",
  "src/components/dashboard/per-user-license-apps-chart.tsx",
  "src/components/dashboard/cost-bar-chart.tsx",
  "src/components/dashboard/cost-apps-table.tsx",
  "src/components/dashboard/upcoming-renewals.tsx",
  "src/components/dashboard/department-spend-chart.tsx",
  // Production actions (dashboard2-seat: dashboard, dashboard2-cost/renewals: AI read-tool)
  "src/actions/dashboard2-seat.ts",
  "src/actions/dashboard2-cost.ts",
  "src/actions/dashboard2-cost.constants.ts",
  "src/actions/dashboard2-renewals.ts",
  // Production types
  "src/types/dashboard2.ts",
  // Pages
  "src/app/(dashboard)/dashboard/page.tsx",
];

// ============================================================
// Helper
// ============================================================

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

// ============================================================
// Tests
// ============================================================

describe("Phase 2: demo route cleanup safety checks", () => {
  describe("files slated for deletion must not exist", () => {
    for (const filePath of ALL_FILES_TO_DELETE) {
      it(`${filePath} is deleted`, () => {
        const abs = path.resolve(PROJECT_ROOT, filePath);
        expect(
          existsSync(abs),
          `File slated for deletion still exists: ${filePath}`
        ).toBe(false);
      });
    }
  });

  describe("all required production files must exist", () => {
    for (const filePath of PRODUCTION_MUST_KEEP_FILES) {
      it(`${filePath} exists`, () => {
        const abs = path.resolve(PROJECT_ROOT, filePath);
        expect(
          existsSync(abs),
          `Required production file missing: ${filePath}`
        ).toBe(true);
      });
    }
  });

  describe("production code must not import deleted modules", () => {
    const productionDirs = [
      path.join(PROJECT_ROOT, "src/app"),
      path.join(PROJECT_ROOT, "src/components/dashboard"),
      path.join(PROJECT_ROOT, "src/components/common"),
      path.join(PROJECT_ROOT, "src/actions"),
      path.join(PROJECT_ROOT, "src/lib"),
    ];

    const productionFiles: string[] = [];
    for (const dir of productionDirs) {
      productionFiles.push(...collectTsFiles(dir));
    }

    // Exclude deletion targets + deleted route pages
    const deleteAbsPaths = new Set(
      ALL_FILES_TO_DELETE.map((f) => path.resolve(PROJECT_ROOT, f))
    );
    const filtered = productionFiles.filter((f) => !deleteAbsPaths.has(f));

    // Import patterns for deleted modules
    const deletedImportPatterns = [
      // All of dashboard-v2-demo deleted
      "@/components/dashboard-v2-demo",
      // dashboard-v2-cost deletion targets
      "@/components/dashboard-v2-cost/dashboard-v2-cost-client",
      "@/components/dashboard-v2-cost/cost-kpi-cards",
      "@/components/dashboard-v2-cost/optimization-hero",
      "@/components/dashboard-v2-cost/savings-breakdown",
      // dashboard-v2-seat deletion targets
      "@/components/dashboard-v2-seat/dashboard-v2-seat-client",
      "@/components/dashboard-v2-seat/seat-kpi-cards",
      "@/components/dashboard-v2-seat/app-efficiency-matrix",
      "@/components/dashboard-v2-seat/optimization-actions",
      // dashboard2 deletion targets (individual)
      "@/components/dashboard2/dashboard2-page-client",
      "@/components/dashboard2/kpi-cards",
      "@/components/dashboard2/alerts-banner",
      "@/components/dashboard2/app-status-overview-card",
      "@/components/dashboard2/apps-table-with-tabs",
      "@/components/dashboard2/detected-apps-table",
      "@/components/dashboard2/device-detected-apps-card",
      "@/components/dashboard2/license-efficiency-card",
      "@/components/dashboard2/monthly-spend-trend-chart",
      "@/components/dashboard2/onboarding-offboarding-card",
      "@/components/dashboard2/security-risk-overview-card",
      "@/components/dashboard2/shadow-it-table",
      "@/components/dashboard2/spend-by-category-card",
      "@/components/dashboard2/spending-apps-table",
      "@/components/dashboard2/top-spending-apps-table",
      "@/components/dashboard2/urgent-renewals-card",
      "@/components/dashboard2/user-overview-card",
      "@/components/dashboard2/users-vs-licenses-chart",
      // Deleted actions (dashboard2-cost and dashboard2-renewals are kept because the AI read-tool uses them)
      "@/actions/dashboard2-security",
      "@/actions/dashboard2-summary",
      "@/actions/dashboard2-users",
      "@/actions/dashboard2-devices",
    ];

    it("has no production files importing deleted modules", () => {
      const violations: { file: string; pattern: string }[] = [];

      for (const filePath of filtered) {
        const content = readFileSync(filePath, "utf-8");
        for (const pattern of deletedImportPatterns) {
          if (content.includes(pattern)) {
            violations.push({
              file: path.relative(PROJECT_ROOT, filePath),
              pattern,
            });
          }
        }
      }

      expect(
        violations,
        `Deleted module imports found in production:\n${violations
          .map((v) => `  ${v.file} → ${v.pattern}`)
          .join("\n")}`
      ).toHaveLength(0);
    });

    it("has no @/actions/dashboard2 barrel imports in production code", () => {
      const violations: string[] = [];
      for (const filePath of filtered) {
        const content = readFileSync(filePath, "utf-8");
        // @/actions/dashboard2" or @/actions/dashboard2' (barrel only, not dashboard2-seat)
        if (/from\s+["']@\/actions\/dashboard2["']/.test(content)) {
          violations.push(path.relative(PROJECT_ROOT, filePath));
        }
      }
      expect(
        violations,
        `@/actions/dashboard2 barrel imports found:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });
  });

  describe("retained index.ts files must not export deleted components", () => {
    it("dashboard2/index.ts exports only seat-utilization-chart and per-user-license-apps-chart", () => {
      const indexPath = path.resolve(
        PROJECT_ROOT,
        "src/components/dashboard2/index.ts"
      );
      if (!existsSync(indexPath)) return;
      const content = readFileSync(indexPath, "utf-8");

      // Deleted components must not be exported
      expect(content).not.toContain("dashboard2-page-client");
      expect(content).not.toContain("kpi-cards");
      expect(content).not.toContain("alerts-banner");
      expect(content).not.toContain("shadow-it-table");
      expect(content).not.toContain("app-status-overview-card");

      // Check exports that are kept
      expect(content).toContain("seat-utilization-chart");
      expect(content).toContain("per-user-license-apps-chart");
    });

    it("dashboard-v2-cost/index.ts exports only cost-bar-chart, cost-apps-table and upcoming-renewals", () => {
      const indexPath = path.resolve(
        PROJECT_ROOT,
        "src/components/dashboard-v2-cost/index.ts"
      );
      if (!existsSync(indexPath)) return;
      const content = readFileSync(indexPath, "utf-8");

      expect(content).not.toContain("dashboard-v2-cost-client");
      expect(content).not.toContain("cost-kpi-cards");
      expect(content).not.toContain("optimization-hero");
      expect(content).not.toContain("savings-breakdown");

      expect(content).toContain("cost-bar-chart");
      expect(content).toContain("cost-apps-table");
      expect(content).toContain("upcoming-renewals");
    });

    it("dashboard-v2-seat/index.ts exports only department-spend-chart", () => {
      const indexPath = path.resolve(
        PROJECT_ROOT,
        "src/components/dashboard-v2-seat/index.ts"
      );
      if (!existsSync(indexPath)) return;
      const content = readFileSync(indexPath, "utf-8");

      expect(content).not.toContain("dashboard-v2-seat-client");
      expect(content).not.toContain("seat-kpi-cards");
      expect(content).not.toContain("app-efficiency-matrix");
      expect(content).not.toContain("optimization-actions");

      expect(content).toContain("department-spend-chart");
    });
  });

  describe("demo route directories are cleaned up", () => {
    it("dashboard-v2-demo directory does not exist", () => {
      const dir = path.resolve(
        PROJECT_ROOT,
        "src/components/dashboard-v2-demo"
      );
      expect(existsSync(dir), "dashboard-v2-demo directory still exists").toBe(
        false
      );
    });

    it("dashboard2 route directory does not exist", () => {
      const dir = path.resolve(PROJECT_ROOT, "src/app/(dashboard)/dashboard2");
      expect(existsSync(dir), "dashboard2 route directory still exists").toBe(
        false
      );
    });

    it("dashboard-v2-demo route directory does not exist", () => {
      const dir = path.resolve(
        PROJECT_ROOT,
        "src/app/(dashboard)/dashboard-v2-demo"
      );
      expect(
        existsSync(dir),
        "dashboard-v2-demo route directory still exists"
      ).toBe(false);
    });

    it("dashboard-v2-cost route directory does not exist", () => {
      const dir = path.resolve(
        PROJECT_ROOT,
        "src/app/(dashboard)/dashboard-v2-cost"
      );
      expect(
        existsSync(dir),
        "dashboard-v2-cost route directory still exists"
      ).toBe(false);
    });

    it("dashboard-v2-seat route directory does not exist", () => {
      const dir = path.resolve(
        PROJECT_ROOT,
        "src/app/(dashboard)/dashboard-v2-seat"
      );
      expect(
        existsSync(dir),
        "dashboard-v2-seat route directory still exists"
      ).toBe(false);
    });
  });
});
