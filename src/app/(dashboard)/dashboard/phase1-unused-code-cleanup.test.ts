// src/app/(dashboard)/dashboard/phase1-unused-code-cleanup.test.ts
// Phase 1 RED: verify production /dashboard still works after deleting unused code
// - Verify files slated for deletion are not imported by production code
// - Verify all production files to keep still exist

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "../../../");
const PROJECT_ROOT = path.resolve(SRC_ROOT, "../");

// ============================================================
// 1. Files to delete (Phase 1)
// ============================================================

/** Files to delete from the dashboard-v3 directory (only DashboardAlertBanner is kept) */
const DASHBOARD_V3_FILES_TO_DELETE = [
  "src/components/dashboard-v3/dashboard-v3-client.tsx",
  "src/components/dashboard-v3/anomaly-kpi-card.tsx",
  "src/components/dashboard-v3/apps-without-sub-kpi-card.tsx",
  "src/components/dashboard-v3/total-cost-kpi-card.tsx",
  "src/components/dashboard-v3/terminated-kpi-card.tsx",
];

/**
 * Old dashboard component files deleted in Phase 1.
 * Phase 5 renamed new-dashboard/ → dashboard/, so the paths collide;
 * only files not moved in Phase 3 (unused in production) are verified.
 * upcoming-renewals and others were moved in Phase 3 and now live in dashboard/.
 */
const DASHBOARD_FILES_TO_DELETE = [
  "src/components/dashboard/dashboard-page-client.tsx",
  "src/components/dashboard/dashboard-page-client.test.tsx",
  "src/components/dashboard/cost-summary-card.tsx",
  "src/components/dashboard/cost-summary-card.test.tsx",
  "src/components/dashboard/dashboard-customization-dialog.tsx",
  "src/components/dashboard/department-overview.tsx",
  "src/components/dashboard/discovery-kpis.tsx",
  "src/components/dashboard/discovery-sources.tsx",
  "src/components/dashboard/monthly-cost-trend.tsx",
  "src/components/dashboard/monthly-cost-trend.test.tsx",
  "src/components/dashboard/pending-confirmations-card.tsx",
  "src/components/dashboard/pending-confirmations-card.test.tsx",
  "src/components/dashboard/savings-opportunity-card.tsx",
  "src/components/dashboard/savings-opportunity-card.test.tsx",
  "src/components/dashboard/security-overview.tsx",
  "src/components/dashboard/stats-cards.tsx",
  "src/components/dashboard/stats-cards.test.tsx",
  "src/components/dashboard/top-apps-cost-chart.tsx",
  "src/components/dashboard/top-apps-cost-chart.test.tsx",
  // upcoming-renewals was moved in Phase 3 and now lives in dashboard/ → excluded
  "src/components/dashboard/cost-analytics-section.tsx",
  "src/components/dashboard/cost-anomaly-alert.tsx",
  "src/components/dashboard/cost-anomaly-alert.test.tsx",
  "src/components/dashboard/date-range-filter.tsx",
  "src/components/dashboard/date-range-filter.test.tsx",
  "src/components/dashboard/export-buttons.tsx",
  "src/components/dashboard/terminated-users-alert.tsx",
  "src/components/dashboard/terminated-users-alert.test.tsx",
  "src/components/dashboard/grid/dashboard-grid-item.tsx",
];

/** Types/actions to delete */
const TYPE_ACTION_FILES_TO_DELETE = [
  "src/types/dashboard-grid.ts",
  "src/types/dashboard-settings.ts",
  "src/actions/dashboard-settings.ts",
  "src/actions/dashboard-settings.test.ts",
];

const ALL_FILES_TO_DELETE = [
  ...DASHBOARD_V3_FILES_TO_DELETE,
  ...DASHBOARD_FILES_TO_DELETE,
  ...TYPE_ACTION_FILES_TO_DELETE,
];

// ============================================================
// 2. Production files to keep
// ============================================================

/** Required production files that must not be deleted */
const PRODUCTION_MUST_KEEP_FILES = [
  // new-dashboard (after the Phase 3 consolidation: all components live here)
  "src/components/dashboard/new-dashboard-client.tsx",
  "src/components/dashboard/bento-kpi-cards.tsx",
  "src/components/dashboard/bento-optimization-hero.tsx",
  "src/components/dashboard/apps-by-category.tsx",
  "src/components/dashboard/recent-activity.tsx",
  "src/components/dashboard/cost-bar-chart.tsx",
  "src/components/dashboard/cost-apps-table.tsx",
  "src/components/dashboard/upcoming-renewals.tsx",
  "src/components/dashboard/seat-utilization-chart.tsx",
  "src/components/dashboard/per-user-license-apps-chart.tsx",
  "src/components/dashboard/department-spend-chart.tsx",
  "src/components/dashboard/dashboard-alert-banner.tsx",
  "src/components/dashboard/index.ts",
  // Page files
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/app/(dashboard)/dashboard/transforms.ts",
  "src/app/(dashboard)/dashboard/transforms.test.ts",
  // Production types/actions (Phase 4: dashboard-v3.ts merged into dashboard.ts)
  "src/types/dashboard.ts",
  "src/actions/dashboard.ts",
  "src/actions/dashboard.test.ts",
];

// ============================================================
// Helper: recursively collect .ts/.tsx files
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

describe("Phase 1: unused code deletion safety checks", () => {
  describe("files slated for deletion must not be imported by production code", () => {
    // Production source directories (excluding deletion targets)
    const productionDirs = [
      path.join(SRC_ROOT, "app"),
      path.join(SRC_ROOT, "components/dashboard"),
      path.join(SRC_ROOT, "components/common"),
      path.join(SRC_ROOT, "actions"),
      path.join(SRC_ROOT, "lib"),
      path.join(SRC_ROOT, "hooks"),
      path.join(SRC_ROOT, "stores"),
    ];

    // Extract module paths from deletion targets
    const deletionModulePaths = ALL_FILES_TO_DELETE.filter(
      (f) => !f.endsWith(".test.ts") && !f.endsWith(".test.tsx")
    ).map((f) => {
      // src/components/dashboard/cost-summary-card.tsx → @/components/dashboard/cost-summary-card
      const withoutSrcAndExt = f
        .replace(/^src\//, "@/")
        .replace(/\.(ts|tsx)$/, "");
      return withoutSrcAndExt;
    });

    // Collect production files
    const productionFiles: string[] = [];
    for (const dir of productionDirs) {
      productionFiles.push(...collectTsFiles(dir));
    }

    // Exclude the deletion targets themselves from the check
    const deleteAbsolutePaths = new Set(
      ALL_FILES_TO_DELETE.map((f) => path.resolve(PROJECT_ROOT, f))
    );
    const filteredProductionFiles = productionFiles.filter(
      (f) => !deleteAbsolutePaths.has(f)
    );

    it("has no production files importing modules slated for deletion", () => {
      const violations: { file: string; importPath: string; line: string }[] =
        [];

      for (const filePath of filteredProductionFiles) {
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        for (const line of lines) {
          // Detect import statements
          if (!line.includes("from") || !line.includes("import")) continue;

          for (const modulePath of deletionModulePaths) {
            if (line.includes(modulePath)) {
              const relPath = path.relative(PROJECT_ROOT, filePath);
              violations.push({
                file: relPath,
                importPath: modulePath,
                line: line.trim(),
              });
            }
          }
        }
      }

      expect(
        violations,
        `Production files importing modules slated for deletion:\n${violations
          .map((v) => `  ${v.file} → ${v.importPath}\n    ${v.line}`)
          .join("\n")}`
      ).toHaveLength(0);
    });

    it("has no dashboard-settings imports in production code", () => {
      const settingsViolations: string[] = [];

      for (const filePath of filteredProductionFiles) {
        const content = readFileSync(filePath, "utf-8");
        if (
          content.includes("@/types/dashboard-settings") ||
          content.includes("@/actions/dashboard-settings")
        ) {
          settingsViolations.push(path.relative(PROJECT_ROOT, filePath));
        }
      }

      expect(
        settingsViolations,
        `Production files importing dashboard-settings:\n${settingsViolations.join("\n")}`
      ).toHaveLength(0);
    });

    it("has no dashboard-grid type imports in production code", () => {
      const gridViolations: string[] = [];

      for (const filePath of filteredProductionFiles) {
        const content = readFileSync(filePath, "utf-8");
        if (content.includes("@/types/dashboard-grid")) {
          gridViolations.push(path.relative(PROJECT_ROOT, filePath));
        }
      }

      expect(
        gridViolations,
        `Production files importing dashboard-grid:\n${gridViolations.join("\n")}`
      ).toHaveLength(0);
    });
  });

  describe("all required production files must exist", () => {
    for (const filePath of PRODUCTION_MUST_KEEP_FILES) {
      it(`${filePath} exists`, () => {
        const absolutePath = path.resolve(PROJECT_ROOT, filePath);
        expect(
          existsSync(absolutePath),
          `Required production file is missing: ${filePath}`
        ).toBe(true);
      });
    }
  });

  describe("files slated for deletion must not exist (post-deletion check)", () => {
    for (const filePath of ALL_FILES_TO_DELETE) {
      it(`${filePath} is deleted`, () => {
        const absolutePath = path.resolve(PROJECT_ROOT, filePath);
        expect(
          existsSync(absolutePath),
          `File slated for deletion still exists: ${filePath}`
        ).toBe(false);
      });
    }
  });

  describe("dashboard-v3 index.ts exports only DashboardAlertBanner", () => {
    it("does not export deleted components from dashboard-v3 index.ts", () => {
      const indexPath = path.resolve(
        PROJECT_ROOT,
        "src/components/dashboard-v3/index.ts"
      );

      if (!existsSync(indexPath)) {
        // If index.ts was deleted, imports must use another path
        return;
      }

      const content = readFileSync(indexPath, "utf-8");

      // Deleted components must not be exported
      expect(content).not.toContain("dashboard-v3-client");
      expect(content).not.toContain("anomaly-kpi-card");
      expect(content).not.toContain("apps-without-sub-kpi-card");
      expect(content).not.toContain("total-cost-kpi-card");
      expect(content).not.toContain("terminated-kpi-card");

      // DashboardAlertBanner is kept
      expect(content).toContain("dashboard-alert-banner");
    });
  });
});
