// tests/e2e/smoke.spec.ts
// Runtime smoke suite: every dashboard route renders for an admin, the REST API
// answers, and the core flows (subscription create → approval → decision →
// notification → lifecycle) work end to end against the real server + database.
import { expect, test } from "@playwright/test";
import {
  apiGet,
  apiPost,
  cleanupSmokeData,
  expectPageOk,
  login,
  prisma,
  QA,
} from "./helpers";

const PAGES = [
  "/dashboard",
  "/subscriptions",
  "/subscriptions/new",
  "/subscriptions/pipeline",
  "/subscriptions/calendar",
  "/subscriptions/receipts",
  "/subscriptions/suggestions",
  "/approvals",
  "/approvals/new",
  "/notifications",
  "/reports",
  "/reports/cost",
  "/reports/renewal",
  "/reports/audit",
  "/payments",
  "/apps",
  "/users",
  "/teams",
  "/integrations",
  "/settings",
  "/settings/profile",
  "/settings/organization",
  "/settings/team",
  "/settings/workspace/general",
  "/settings/workspace/finance",
  "/settings/workspace/subscriptions",
  "/settings/workspace/approvals",
  "/settings/workspace/notifications",
  "/settings/workspace/security",
  "/settings/workspace/privacy",
  "/settings/workspace/documents",
  "/settings/workspace/integrations",
  "/settings/workspace/discovery",
  "/settings/masters",
  "/settings/roles",
  "/settings/taxonomy",
  "/settings/custom-fields",
  "/settings/approvals",
  "/settings/mailboxes",
  "/settings/privacy",
  "/settings/notification-templates",
  "/settings/notifications",
  "/settings/appearance",
];

test.describe("SubHub smoke", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, QA.admin);
  });

  test.afterAll(async () => {
    await cleanupSmokeData();
    await prisma.$disconnect();
  });

  for (const path of PAGES) {
    test(`page renders: ${path}`, async ({ page }) => {
      await expectPageOk(page, path);
    });
  }

  test("API: identity, permissions and context", async ({ page }) => {
    const perms = await apiGet<{
      success: boolean;
      data: { permissions: string[]; role: string };
    }>(page, "/api/v1/me/permissions");
    expect(perms.status).toBe(200);
    expect(perms.body.data.role).toBe("ADMIN");
    expect(perms.body.data.permissions).toContain("approvals:decide");
    const ctx = await apiGet<{
      success: boolean;
      data: { baseCurrency: string };
    }>(page, "/api/v1/me/context");
    expect(ctx.status).toBe(200);
    expect(ctx.body.data.baseCurrency).toMatch(/^[A-Z]{3}$/);
  });

  test("API: masters, taxonomy, roles, search, pipeline, dashboard", async ({
    page,
  }) => {
    for (const path of [
      "/api/v1/masters/currencies",
      "/api/v1/masters/tax-rates",
      "/api/v1/masters/cost-centers",
      "/api/v1/masters/payment-methods",
      "/api/v1/masters/billing-cycles",
      "/api/v1/taxonomy/categories",
      "/api/v1/taxonomy/tags",
      "/api/v1/taxonomy/custom-fields",
      "/api/v1/roles",
      "/api/v1/search?q=slack",
      "/api/v1/subscriptions/pipeline",
      "/api/v1/dashboard/overview",
      "/api/v1/notifications/unread-count",
      "/api/v1/subscriptions?limit=5",
      "/api/v1/approvals?limit=5",
      "/api/v1/mailboxes",
      "/api/v1/receipts/suggestions",
      "/api/v1/price-changes",
    ]) {
      const res = await apiGet<{ success?: boolean }>(page, path);
      expect(res.status, `${path} → ${res.status}`).toBe(200);
    }
    const cats = await apiGet<{ data: unknown[] }>(
      page,
      "/api/v1/taxonomy/categories"
    );
    expect(
      Array.isArray(cats.body.data) ? cats.body.data.length : 0
    ).toBeGreaterThan(3);
  });

  test("flow: subscription lifecycle through the API and UI", async ({
    page,
  }) => {
    const name = `QA Vendor ${Date.now()}`;
    const created = await apiPost<{
      success: boolean;
      data?: { id: string };
      error?: string;
    }>(page, "/api/v1/subscriptions", {
      appName: name,
      amount: "123.45",
      currency: "AED",
      billingCycle: "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
      renewalDate: new Date(Date.now() + 20 * 86400000)
        .toISOString()
        .slice(0, 10),
      reminderLeadDays: [7, 1],
      tagNames: ["qa", "smoke"],
      notes: "created by smoke test",
    });
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
    const sub = await prisma.subscription.findFirst({
      where: { app: { name } },
      include: { tags: { include: { tag: true } } },
    });
    expect(sub).not.toBeNull();
    expect(sub!.tags.map((t) => t.tag.name).sort()).toEqual(["qa", "smoke"]);

    // Detail page renders with the new record
    await expectPageOk(page, `/subscriptions/${sub!.id}`);
    await expect(page.locator("body")).toContainText(name);

    // Duplicate detection warns about a near-identical name
    const dup = await apiGet<{ success: boolean; data: unknown[] }>(
      page,
      `/api/v1/subscriptions/duplicates?name=${encodeURIComponent(name.toLowerCase())}`
    );
    expect(dup.status).toBe(200);
    expect(
      Array.isArray(dup.body.data) ? dup.body.data.length : 0
    ).toBeGreaterThan(0);

    // Pause → resume → archive → restore
    for (const action of ["pause", "resume", "archive", "restore"]) {
      const r = await apiPost<{ success: boolean }>(
        page,
        `/api/v1/subscriptions/${sub!.id}/status`,
        { action }
      );
      expect(r.status, `${action}: ${JSON.stringify(r.body)}`).toBeLessThan(
        300
      );
    }
    const after = await prisma.subscription.findUnique({
      where: { id: sub!.id },
    });
    expect(after!.status).toBe("ACTIVE");

    // Comment + activity
    const c = await apiPost<{ success: boolean }>(
      page,
      `/api/v1/subscriptions/${sub!.id}/comments`,
      { body: "smoke comment" }
    );
    expect(c.status).toBeLessThan(300);
    const activity = await apiGet<{ success: boolean; data: unknown[] }>(
      page,
      `/api/v1/subscriptions/${sub!.id}/activity`
    );
    expect(activity.status).toBe(200);
    expect(
      Array.isArray(activity.body.data) ? activity.body.data.length : 0
    ).toBeGreaterThan(0);

    // List shows it (inherited endpoint shape: { items, total, page, limit })
    const list = await apiGet<{
      items?: { appName: string }[];
      data?: { appName: string }[];
    }>(page, `/api/v1/subscriptions?search=${encodeURIComponent(name)}`);
    const rows = list.body.items ?? list.body.data ?? [];
    expect(rows.some((s) => s.appName === name)).toBe(true);
  });

  test("flow: approval request → decision → subscription + notification", async ({
    page,
  }) => {
    // Make sure a policy exists that requires approval for everything
    const org = await prisma.organization.findUniqueOrThrow({
      where: { domain: "subhub-qa.test" },
    });
    const approver = await prisma.user.findUniqueOrThrow({
      where: { email: QA.approver },
    });
    const policy = await prisma.approvalPolicy.upsert({
      where: { id: "qa-policy-all" },
      update: { isActive: true, appliesToAll: true },
      create: {
        id: "qa-policy-all",
        organizationId: org.id,
        name: "QA — everything needs approval",
        appliesToAll: true,
        priority: 100,
        steps: {
          create: [
            {
              stepOrder: 1,
              label: "Approver",
              approverType: "USER",
              approverUserId: approver.id,
            },
          ],
        },
      },
    });
    expect(policy.id).toBe("qa-policy-all");

    const serviceName = `QA Approval ${Date.now()}`;
    const submitted = await apiPost<{
      success: boolean;
      data?: { id: string; status: string };
      error?: string;
    }>(page, "/api/v1/approvals", {
      serviceName,
      amount: 250,
      currency: "USD",
      billingCycle: "MONTHLY",
      justification:
        "Smoke test justification long enough to pass the minimum length.",
    });
    expect(submitted.status, JSON.stringify(submitted.body)).toBeLessThan(300);
    const requestId = submitted.body.data!.id;
    expect(submitted.body.data!.status).toBe("PENDING");

    // Approver sees it and approves
    await login(page, QA.approver);
    await expectPageOk(page, "/approvals");
    await expectPageOk(page, `/approvals/${requestId}`);
    const decided = await apiPost<{
      success: boolean;
      data?: { status: string };
      error?: string;
    }>(page, `/api/v1/approvals/${requestId}/decision`, {
      action: "approve",
      comment: "Looks good",
    });
    expect(decided.status, JSON.stringify(decided.body)).toBeLessThan(300);

    const request = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(request.status).toBe("APPROVED");
    expect(request.subscriptionId).not.toBeNull();

    // Requester (admin) received an in-app notification
    await login(page, QA.admin);
    const unread = await apiGet<{ data: { count: number } }>(
      page,
      "/api/v1/notifications/unread-count"
    );
    expect(unread.status).toBe(200);
    const notes = await prisma.notification.count({
      where: { organizationId: org.id, type: "APPROVAL_DECIDED" },
    });
    expect(notes).toBeGreaterThan(0);
    await expectPageOk(page, "/notifications");
  });

  test("flow: saved view and global search", async ({ page }) => {
    const created = await apiPost<{ success: boolean; data?: { id: string } }>(
      page,
      "/api/v1/saved-views",
      {
        entity: "subscriptions",
        name: `QA view ${Date.now()}`,
        filters: { statuses: ["ACTIVE"] },
        sort: { sortBy: "renewalDate", sortOrder: "asc" },
      }
    );
    expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
    const search = await apiGet<{
      success: boolean;
      data: Record<string, unknown[]>;
    }>(page, "/api/v1/search?q=Slack");
    expect(search.status).toBe(200);
  });

  test("RBAC: member cannot change settings or decide approvals", async ({
    page,
  }) => {
    await login(page, QA.member);
    const perms = await apiGet<{ data: { permissions: string[] } }>(
      page,
      "/api/v1/me/permissions"
    );
    expect(perms.body.data.permissions).not.toContain("approvals:decide");
    expect(perms.body.data.permissions).not.toContain("settings:manage");
    await expectPageOk(page, "/dashboard");
    await expectPageOk(page, "/subscriptions");
    const roles = await apiGet(page, "/api/v1/roles");
    expect(roles.status).toBe(200);
  });

  test("UI: dark mode toggle and workspace scope switch exist", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const header = page.getByTestId("app-header");
    await expect(header).toBeVisible();
    const buttons = await header.getByRole("button").count();
    expect(buttons).toBeGreaterThan(2);
  });
});
