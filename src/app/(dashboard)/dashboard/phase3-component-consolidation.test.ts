// src/app/(dashboard)/dashboard/phase3-component-consolidation.test.ts
// Phase 3 RED: verify production components are consolidated into new-dashboard/
// - Moved components must exist in new-dashboard/
// - Old directories (dashboard/, dashboard2/, v2-cost/, v2-seat/, v3/) must be deleted
// - Bento pass-through wrappers must be removed
// - new-dashboard-client must import the moved components directly

import { existsSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const NEW_DASHBOARD = "src/components/dashboard";

// ============================================================
// 1. Moved files that must exist in new-dashboard/
// ============================================================

const MOVED_FILES_MUST_EXIST = [
  // dashboard/ → new-dashboard/
  `${NEW_DASHBOARD}/apps-by-category.tsx`,
  `${NEW_DASHBOARD}/apps-by-category.test.tsx`,
  `${NEW_DASHBOARD}/recent-activity.tsx`,
  `${NEW_DASHBOARD}/recent-activity.test.tsx`,
  // dashboard2/ → new-dashboard/
  `${NEW_DASHBOARD}/seat-utilization-chart.tsx`,
  `${NEW_DASHBOARD}/per-user-license-apps-chart.tsx`,
  // dashboard-v2-cost/ → new-dashboard/
  `${NEW_DASHBOARD}/cost-bar-chart.tsx`,
  `${NEW_DASHBOARD}/cost-apps-table.tsx`,
  `${NEW_DASHBOARD}/upcoming-renewals.tsx`,
  // dashboard-v2-seat/ → new-dashboard/
  `${NEW_DASHBOARD}/department-spend-chart.tsx`,
  // dashboard-v3/ → new-dashboard/
  `${NEW_DASHBOARD}/dashboard-alert-banner.tsx`,
  `${NEW_DASHBOARD}/dashboard-alert-banner.test.tsx`,
];

// ============================================================
// 2. Self-implemented components (not moved, kept as is)
// ============================================================

const SELF_IMPLEMENTED_MUST_EXIST = [
  `${NEW_DASHBOARD}/new-dashboard-client.tsx`,
  `${NEW_DASHBOARD}/new-dashboard-client.test.tsx`,
  `${NEW_DASHBOARD}/bento-optimization-hero.tsx`,
  `${NEW_DASHBOARD}/bento-kpi-cards.tsx`,
  `${NEW_DASHBOARD}/anomaly-card.tsx`,
  `${NEW_DASHBOARD}/apps-without-sub-card.tsx`,
  `${NEW_DASHBOARD}/terminated-card.tsx`,
  `${NEW_DASHBOARD}/total-cost-card.tsx`,
  `${NEW_DASHBOARD}/index.ts`,
];

// ============================================================
// 3. Bento pass-through wrappers that must be deleted
// ============================================================

const BENTO_WRAPPERS_TO_DELETE = [
  `${NEW_DASHBOARD}/bento-apps-by-category.tsx`,
  `${NEW_DASHBOARD}/bento-recent-activity.tsx`,
  `${NEW_DASHBOARD}/bento-cost-bar-chart.tsx`,
  `${NEW_DASHBOARD}/bento-cost-apps-table.tsx`,
  `${NEW_DASHBOARD}/bento-upcoming-renewals.tsx`,
  `${NEW_DASHBOARD}/bento-seat-utilization.tsx`,
  `${NEW_DASHBOARD}/bento-per-user-license.tsx`,
  `${NEW_DASHBOARD}/bento-department-spend.tsx`,
];

// ============================================================
// 4. Old directories that must be deleted
// ============================================================

// Phase 5 renamed new-dashboard/ → dashboard/. dashboard/ currently exists.
const OLD_DIRS_TO_DELETE = [
  "src/components/dashboard2",
  "src/components/dashboard-v2-cost",
  "src/components/dashboard-v2-seat",
  "src/components/dashboard-v3",
];

// ============================================================
// Tests
// ============================================================

describe("Phase 3: production component consolidation checks", () => {
  describe("moved components must exist in new-dashboard/", () => {
    for (const filePath of MOVED_FILES_MUST_EXIST) {
      it(`${filePath} exists`, () => {
        const abs = path.resolve(PROJECT_ROOT, filePath);
        expect(existsSync(abs), `Moved file missing: ${filePath}`).toBe(true);
      });
    }
  });

  describe("self-implemented components must be kept", () => {
    for (const filePath of SELF_IMPLEMENTED_MUST_EXIST) {
      it(`${filePath} exists`, () => {
        const abs = path.resolve(PROJECT_ROOT, filePath);
        expect(
          existsSync(abs),
          `Self-implemented file missing: ${filePath}`
        ).toBe(true);
      });
    }
  });

  describe("Bento pass-through wrappers must be deleted", () => {
    for (const filePath of BENTO_WRAPPERS_TO_DELETE) {
      it(`${filePath} is deleted`, () => {
        const abs = path.resolve(PROJECT_ROOT, filePath);
        expect(existsSync(abs), `Bento wrapper still exists: ${filePath}`).toBe(
          false
        );
      });
    }
  });

  describe("old directories must be fully deleted", () => {
    for (const dirPath of OLD_DIRS_TO_DELETE) {
      it(`${dirPath}/ is deleted`, () => {
        const abs = path.resolve(PROJECT_ROOT, dirPath);
        expect(existsSync(abs), `Old directory still exists: ${dirPath}`).toBe(
          false
        );
      });
    }
  });

  describe("new-dashboard-client must not import external directories", () => {
    it("no @/components/dashboard/ imports", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toMatch(/from\s+["']@\/components\/dashboard\//);
    });

    it("no @/components/dashboard2/ imports", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toMatch(/from\s+["']@\/components\/dashboard2\//);
    });

    it("no @/components/dashboard-v2-cost/ imports", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toMatch(
        /from\s+["']@\/components\/dashboard-v2-cost\//
      );
    });

    it("no @/components/dashboard-v2-seat/ imports", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toMatch(
        /from\s+["']@\/components\/dashboard-v2-seat\//
      );
    });

    it("no @/components/dashboard-v3/ imports", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toMatch(/from\s+["']@\/components\/dashboard-v3/);
    });

    it("does not import deleted bento- wrappers", () => {
      const clientPath = path.resolve(
        PROJECT_ROOT,
        `${NEW_DASHBOARD}/new-dashboard-client.tsx`
      );
      const content = readFileSync(clientPath, "utf-8");
      expect(content).not.toContain("bento-apps-by-category");
      expect(content).not.toContain("bento-recent-activity");
      expect(content).not.toContain("bento-cost-bar-chart");
      expect(content).not.toContain("bento-cost-apps-table");
      expect(content).not.toContain("bento-upcoming-renewals");
      expect(content).not.toContain("bento-seat-utilization");
      expect(content).not.toContain("bento-per-user-license");
      expect(content).not.toContain("bento-department-spend");
    });
  });

  describe("new-dashboard/index.ts is cleaned up", () => {
    it("does not export deleted bento wrappers", () => {
      const indexPath = path.resolve(PROJECT_ROOT, `${NEW_DASHBOARD}/index.ts`);
      const content = readFileSync(indexPath, "utf-8");
      expect(content).not.toContain("BentoAppsByCategory");
      expect(content).not.toContain("BentoCostAppsTable");
      expect(content).not.toContain("BentoCostBarChart");
      expect(content).not.toContain("BentoDepartmentSpend");
      expect(content).not.toContain("BentoPerUserLicense");
      expect(content).not.toContain("BentoRecentActivity");
      expect(content).not.toContain("BentoSeatUtilization");
      expect(content).not.toContain("BentoUpcomingRenewals");
    });

    it("exports the moved components", () => {
      const indexPath = path.resolve(PROJECT_ROOT, `${NEW_DASHBOARD}/index.ts`);
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("AppsByCategory");
      expect(content).toContain("RecentActivity");
      expect(content).toContain("CostBarChart");
      expect(content).toContain("CostAppsTable");
      expect(content).toContain("UpcomingRenewals");
      expect(content).toContain("SeatUtilizationChart");
      expect(content).toContain("PerUserLicenseAppsChart");
      expect(content).toContain("DepartmentSpendChart");
      expect(content).toContain("DashboardAlertBanner");
    });
  });
});
