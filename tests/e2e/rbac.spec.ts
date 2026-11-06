// tests/e2e/rbac.spec.ts
// Role-based access control: for each seeded QA role, allowed pages render,
// forbidden pages redirect away (page-level requirePermissionOrRedirect), the
// sidebar only lists permitted areas, and forbidden API mutations answer 403.
// The matrix behind these lists is docs/RBAC-MATRIX.md.
import { expect, test, type Page } from "@playwright/test";
import { apiGet, apiPost, expectPageOk, login, QA } from "./helpers";

/** Seeded by scripts/seed-smoke.ts alongside the other QA users. */
const QA_VIEWER = "qa-viewer@subhub-qa.test";

interface RoleCase {
  name: string;
  email: string;
  allowed: string[];
  forbidden: string[];
  /** Mutations that must be refused with 403. */
  forbiddenApi: { method: "GET" | "POST"; path: string }[];
  /** Sidebar entries that must (true) or must not (false) be shown. */
  sidebar: Record<string, boolean>;
  /** Keys the effective permission set must / must not contain. */
  permissions: { has: string[]; lacks: string[] };
}

const CASES: RoleCase[] = [
  {
    name: "admin",
    email: QA.admin,
    allowed: [
      "/settings/roles",
      "/settings/organization",
      "/settings/team",
      "/extensions/usage",
      "/payments",
      "/integrations/new",
      "/subscriptions/suggestions",
    ],
    forbidden: [],
    forbiddenApi: [],
    sidebar: { Payments: true, Extensions: true, Approvals: true },
    permissions: {
      has: ["roles:manage", "settings:manage", "approvals:decide"],
      lacks: [],
    },
  },
  {
    name: "approver",
    email: QA.approver,
    allowed: [
      "/approvals",
      "/subscriptions",
      "/payments",
      "/reports/cost",
      "/reports/audit",
    ],
    forbidden: [
      "/settings/roles",
      "/settings/organization",
      "/settings/team",
      "/settings/import",
      "/extensions/usage",
      "/integrations/new",
      "/org/sync",
      "/subscriptions/suggestions",
    ],
    forbiddenApi: [
      { method: "POST", path: "/api/v1/integrations" },
      { method: "POST", path: "/api/v1/payments/rematch" },
    ],
    sidebar: { Payments: true, Extensions: false, Approvals: true },
    permissions: {
      has: ["approvals:decide", "subscriptions:read_all"],
      lacks: ["roles:manage", "settings:manage", "members:manage"],
    },
  },
  {
    name: "member",
    email: QA.member,
    allowed: [
      "/subscriptions",
      "/subscriptions/new",
      "/approvals",
      "/approvals/new",
      "/notifications",
      "/settings/profile",
      "/settings/appearance",
      "/settings/notifications",
    ],
    forbidden: [
      "/payments",
      "/extensions/usage",
      "/settings/roles",
      "/settings/organization",
      "/settings/team",
      "/integrations/new",
      "/subscriptions/suggestions",
    ],
    forbiddenApi: [
      { method: "POST", path: "/api/v1/approvals/bulk-decision" },
      { method: "GET", path: "/api/v1/approvals/decision-options" },
      { method: "POST", path: "/api/v1/integrations" },
      { method: "POST", path: "/api/v1/payments/rematch" },
    ],
    sidebar: { Payments: false, Extensions: false, Approvals: true },
    permissions: {
      has: ["approvals:create", "subscriptions:create"],
      lacks: ["approvals:decide", "settings:manage", "roles:manage"],
    },
  },
  {
    name: "viewer",
    email: QA_VIEWER,
    allowed: ["/subscriptions", "/approvals", "/settings/profile"],
    forbidden: [
      "/subscriptions/new",
      "/approvals/new",
      "/payments",
      "/reports/audit",
      "/settings/roles",
      "/extensions/usage",
    ],
    forbiddenApi: [
      { method: "POST", path: "/api/v1/subscriptions" },
      { method: "POST", path: "/api/v1/approvals" },
      { method: "POST", path: "/api/v1/approvals/bulk-decision" },
    ],
    sidebar: { Payments: false, Extensions: false, Approvals: true },
    permissions: {
      has: ["subscriptions:read"],
      lacks: ["subscriptions:create", "approvals:create", "tags:create"],
    },
  },
];

function pathPattern(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}(\\?.*)?$`);
}

async function expectRedirectedAway(page: Page, path: string): Promise<void> {
  // The guard redirect is streamed (NEXT_REDIRECT) and applied client-side,
  // so wait for the URL to change rather than for an HTTP 307.
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page, `${path} should redirect`).not.toHaveURL(
    pathPattern(path),
    { timeout: 30_000 }
  );
}

for (const role of CASES) {
  test.describe(`RBAC: ${role.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await login(page, role.email);
    });

    test("effective permissions match the role template", async ({ page }) => {
      const { status, body } = await apiGet<{
        data?: { permissions?: string[] };
      }>(page, "/api/v1/me/permissions");
      expect(status).toBe(200);
      const keys = new Set(body.data?.permissions ?? []);
      for (const key of role.permissions.has) expect(keys, key).toContain(key);
      for (const key of role.permissions.lacks)
        expect(keys, key).not.toContain(key);
    });

    test("allowed pages render", async ({ page }) => {
      for (const path of role.allowed) {
        await expectPageOk(page, path);
        await expect(page, path).toHaveURL(pathPattern(path));
      }
    });

    test("forbidden pages redirect away", async ({ page }) => {
      test.skip(role.forbidden.length === 0, "no forbidden pages");
      for (const path of role.forbidden) {
        await expectRedirectedAway(page, path);
      }
    });

    test("sidebar lists only permitted areas", async ({ page }) => {
      await page.goto("/subscriptions", { waitUntil: "networkidle" });
      const sidebar = page.getByTestId("app-sidebar");
      for (const [label, shown] of Object.entries(role.sidebar)) {
        const link = sidebar.getByRole("link", { name: label, exact: true });
        if (shown) await expect(link, label).toBeVisible();
        else await expect(link, label).toHaveCount(0);
      }
    });

    test("forbidden API mutations answer 403", async ({ page }) => {
      test.skip(role.forbiddenApi.length === 0, "no forbidden API calls");
      for (const call of role.forbiddenApi) {
        const { status } =
          call.method === "GET"
            ? await apiGet(page, call.path)
            : await apiPost(page, call.path, {});
        expect(status, `${call.method} ${call.path}`).toBe(403);
      }
    });
  });
}
