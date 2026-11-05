// src/app/(dashboard)/dashboard/phase4-type-consolidation.test.ts
// Phase 4 RED: type system consolidation checks
// 1) Merge dashboard-v3.ts into dashboard.ts
// 2) Move production types from dashboard2.ts to dashboard.ts; keep the rest separate
// 3) Move RenewalReportData from actions/ to types/
// 4) Remove duplicate types from dashboard2-seat.ts

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

function readFile(relPath: string): string {
  return readFileSync(path.resolve(PROJECT_ROOT, relPath), "utf-8");
}

function fileExists(relPath: string): boolean {
  return existsSync(path.resolve(PROJECT_ROOT, relPath));
}

// ============================================================
// Helper: collect source files
// ============================================================
function collectTsFiles(dir: string): string[] {
  // readdirSync is imported at top level
  const results: string[] = [];
  const absDir = path.resolve(PROJECT_ROOT, dir);
  if (!existsSync(absDir)) return results;
  const entries = readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(path.join(dir, entry.name)));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      results.push(full);
    }
  }
  return results;
}

describe("Phase 4: type system consolidation checks", () => {
  // ─── 1. Delete dashboard-v3.ts ───

  describe("dashboard-v3.ts must be deleted", () => {
    it("src/types/dashboard-v3.ts does not exist", () => {
      expect(fileExists("src/types/dashboard-v3.ts")).toBe(false);
    });

    it("has no @/types/dashboard-v3 imports in the codebase", () => {
      const dirs = ["src/app", "src/components", "src/actions", "src/lib"];
      const allFiles = dirs.flatMap((d) => collectTsFiles(d));
      const violations: string[] = [];
      for (const f of allFiles) {
        const content = readFileSync(f, "utf-8");
        if (content.includes("@/types/dashboard-v3")) {
          violations.push(path.relative(PROJECT_ROOT, f));
        }
      }
      expect(
        violations,
        `Files importing @/types/dashboard-v3:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });
  });

  // ─── 2. dashboard-v3 types merged into dashboard.ts ───

  describe("dashboard-v3 types must exist in dashboard.ts", () => {
    const expectedTypes = [
      "OptimizationHeroData",
      "RenewalItem",
      "TotalCostKpiData",
      "AnomalyKpiData",
      "TerminatedKpiData",
      "AppsWithoutSubKpiData",
      "MonthlyBarData",
      "CostAppData",
      "SubscriptionAnomalyItem",
      "DashboardV3Data",
    ];

    for (const typeName of expectedTypes) {
      it(`defines ${typeName} in dashboard.ts`, () => {
        const content = readFile("src/types/dashboard.ts");
        expect(content).toContain(`export interface ${typeName}`);
      });
    }
  });

  // ─── 3. Move production Seat types from dashboard2.ts to dashboard.ts ───

  describe("Seat-related production types must exist in dashboard.ts", () => {
    const seatTypes = [
      "LowUtilizationApp",
      "TopLicenseApp",
      "SeatWidgetData",
      "LicenseUsageTrend",
    ];

    for (const typeName of seatTypes) {
      it(`defines ${typeName} in dashboard.ts`, () => {
        const content = readFile("src/types/dashboard.ts");
        expect(content).toContain(`export interface ${typeName}`);
      });
    }
  });

  // ─── 4. RenewalReportData moved to types/ ───

  describe("RenewalReportData must live in the types file", () => {
    it("defines RenewalReportData in dashboard.ts", () => {
      const content = readFile("src/types/dashboard.ts");
      expect(content).toContain("export interface RenewalReportData");
    });

    it("has no RenewalReportData interface in actions/dashboard.ts", () => {
      const content = readFile("src/actions/dashboard.ts");
      expect(content).not.toContain("export interface RenewalReportData");
    });
  });

  // ─── 5. Remove duplicate types from dashboard2-seat.ts ───

  describe("duplicate types must be removed from dashboard2-seat.ts", () => {
    it("has no LowUtilizationApp interface in dashboard2-seat.ts", () => {
      const content = readFile("src/actions/dashboard2-seat.ts");
      expect(content).not.toContain("export interface LowUtilizationApp");
    });

    it("has no TopLicenseApp interface in dashboard2-seat.ts", () => {
      const content = readFile("src/actions/dashboard2-seat.ts");
      expect(content).not.toContain("export interface TopLicenseApp");
    });

    it("has no SeatWidgetData interface in dashboard2-seat.ts", () => {
      const content = readFile("src/actions/dashboard2-seat.ts");
      expect(content).not.toContain("export interface SeatWidgetData");
    });

    it("dashboard2-seat.ts imports types from dashboard.ts", () => {
      const content = readFile("src/actions/dashboard2-seat.ts");
      expect(content).toContain("@/types/dashboard");
    });
  });

  // ─── 6. Existing imports migrated to @/types/dashboard ───

  describe("all imports must use @/types/dashboard", () => {
    it("has no files importing Seat types from @/types/dashboard2 (excluding dashboard2 business types)", () => {
      const dirs = [
        "src/components/dashboard",
        "src/app/(dashboard)/dashboard",
      ];
      const allFiles = dirs.flatMap((d) => collectTsFiles(d));
      const violations: string[] = [];
      for (const f of allFiles) {
        const content = readFileSync(f, "utf-8");
        if (content.includes("@/types/dashboard2")) {
          violations.push(path.relative(PROJECT_ROOT, f));
        }
      }
      expect(
        violations,
        `@/types/dashboard2 imports in new-dashboard/dashboard:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });
  });

  // ─── 7. dashboard.ts file size limit ───

  describe("dashboard.ts must not exceed 500 lines", () => {
    it("dashboard.ts is within 500 lines", () => {
      const content = readFile("src/types/dashboard.ts");
      const lineCount = content.split("\n").length;
      expect(
        lineCount,
        `dashboard.ts: ${lineCount} lines (exceeds the 500-line limit)`
      ).toBeLessThanOrEqual(500);
    });
  });
});
