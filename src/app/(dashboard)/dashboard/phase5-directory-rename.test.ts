// src/app/(dashboard)/dashboard/phase5-directory-rename.test.ts
// Phase 5 RED: verify the new-dashboard/ → dashboard/ directory rename

import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

function fileExists(relPath: string): boolean {
  return existsSync(path.resolve(PROJECT_ROOT, relPath));
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  const absDir = path.resolve(PROJECT_ROOT, dir);
  if (!existsSync(absDir)) return results;
  const entries = readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(path.join(dir, entry.name)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe("Phase 5: directory rename checks", () => {
  describe("new-dashboard/ → dashboard/ rename", () => {
    it("src/components/dashboard/ directory exists", () => {
      expect(fileExists("src/components/dashboard")).toBe(true);
    });

    it("src/components/new-dashboard/ directory does not exist", () => {
      expect(fileExists("src/components/new-dashboard")).toBe(false);
    });
  });

  describe("core files must exist in dashboard/", () => {
    const files = [
      "src/components/dashboard/new-dashboard-client.tsx",
      "src/components/dashboard/new-dashboard-client.test.tsx",
      "src/components/dashboard/bento-kpi-cards.tsx",
      "src/components/dashboard/bento-optimization-hero.tsx",
      "src/components/dashboard/index.ts",
      "src/components/dashboard/apps-by-category.tsx",
      "src/components/dashboard/recent-activity.tsx",
      "src/components/dashboard/cost-bar-chart.tsx",
      "src/components/dashboard/cost-apps-table.tsx",
      "src/components/dashboard/upcoming-renewals.tsx",
      "src/components/dashboard/seat-utilization-chart.tsx",
      "src/components/dashboard/per-user-license-apps-chart.tsx",
      "src/components/dashboard/department-spend-chart.tsx",
      "src/components/dashboard/dashboard-alert-banner.tsx",
    ];

    for (const f of files) {
      it(`${path.basename(f)} exists`, () => {
        expect(fileExists(f), `File missing: ${f}`).toBe(true);
      });
    }
  });

  describe("import paths must use @/components/dashboard", () => {
    it("page.tsx imports from @/components/dashboard", () => {
      const content = readFileSync(
        path.resolve(PROJECT_ROOT, "src/app/(dashboard)/dashboard/page.tsx"),
        "utf-8"
      );
      expect(content).toContain('@/components/dashboard"');
      expect(content).not.toContain("@/components/new-dashboard");
    });
  });

  describe("the codebase has no @/components/new-dashboard references", () => {
    it("has no new-dashboard imports in source code", () => {
      const dirs = ["src/app", "src/components", "src/actions", "src/lib"];
      const allFiles = dirs.flatMap((d) => collectTsFiles(d));
      const violations: string[] = [];
      for (const f of allFiles) {
        // Exclude the test file itself from the check
        if (f.endsWith(".test.ts") || f.endsWith(".test.tsx")) continue;
        const content = readFileSync(f, "utf-8");
        if (content.includes("@/components/new-dashboard")) {
          violations.push(path.relative(PROJECT_ROOT, f));
        }
      }
      expect(
        violations,
        `@/components/new-dashboard references:\n${violations.join("\n")}`
      ).toHaveLength(0);
    });
  });
});
