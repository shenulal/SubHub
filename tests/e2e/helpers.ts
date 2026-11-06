// tests/e2e/helpers.ts
import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const prisma = new PrismaClient();

export const QA = {
  admin: "qa-admin@subhub-qa.test",
  approver: "qa-approver@subhub-qa.test",
  member: "qa-member@subhub-qa.test",
};

/**
 * QA user password: SEED_QA_PASSWORD from the environment, or from .env.local
 * (never hard-coded). The smoke seed gives the QA users this password.
 */
export function qaPassword(): string {
  if (process.env.SEED_QA_PASSWORD) return process.env.SEED_QA_PASSWORD;
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const m = env.match(/^SEED_QA_PASSWORD=(?:"([^"]*)"|'([^']*)'|(.*))$/m);
    if (m) return (m[1] ?? m[2] ?? m[3] ?? "").trim();
  } catch {
    // fall through
  }
  throw new Error(
    "SEED_QA_PASSWORD is not set (env or .env.local); seed the QA users with it"
  );
}

/** Sign in through the NextAuth `password` credentials provider. */
export async function login(page: Page, email: string): Promise<void> {
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post("/api/auth/callback/password", {
    form: {
      csrfToken,
      identifier: email,
      password: qaPassword(),
      redirectTo: "/dashboard",
    },
    maxRedirects: 0,
  });
  expect([200, 302]).toContain(res.status());
  const session = await page.request.get("/api/auth/session");
  const body = (await session.json()) as { user?: { email?: string } };
  expect(body.user?.email).toBe(email);
}

const ERROR_MARKERS = [
  "Application error",
  "Internal Server Error",
  "Unhandled Runtime Error",
  "This page could not be found",
  "Something went wrong",
];

/** Visit a page and assert it rendered without an error boundary or 404. */
export async function expectPageOk(page: Page, path: string): Promise<void> {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  page.on("pageerror", onError);
  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response, `no response for ${path}`).not.toBeNull();
  expect(
    response!.status(),
    `${path} returned ${response!.status()}`
  ).toBeLessThan(400);
  const text = await page.locator("body").innerText();
  for (const marker of ERROR_MARKERS) {
    expect(text, `${path} shows "${marker}"`).not.toContain(marker);
  }
  page.off("pageerror", onError);
  expect(errors, `${path} threw: ${errors.join(" | ")}`).toEqual([]);
}

export async function apiGet<T = unknown>(
  page: Page,
  path: string
): Promise<{ status: number; body: T }> {
  const res = await page.request.get(path);
  return {
    status: res.status(),
    body: (await res.json().catch(() => null)) as T,
  };
}

export async function apiPost<T = unknown>(
  page: Page,
  path: string,
  data: unknown
): Promise<{ status: number; body: T }> {
  const res = await page.request.post(path, { data });
  return {
    status: res.status(),
    body: (await res.json().catch(() => null)) as T,
  };
}

/**
 * Removes the records the smoke flows create ("QA Approval …", "QA Vendor …",
 * "QA view …") so repeated runs leave no test data behind in the application.
 */
export async function cleanupSmokeData(): Promise<void> {
  const apps = await prisma.app.findMany({
    where: {
      OR: [
        { name: { startsWith: "QA Approval " } },
        { name: { startsWith: "QA Vendor " } },
      ],
    },
    select: { id: true },
  });
  const appIds = apps.map((a) => a.id);
  const subs = await prisma.subscription.findMany({
    where: { appId: { in: appIds } },
    select: { id: true },
  });
  const subIds = subs.map((s) => s.id);
  const requests = await prisma.approvalRequest.findMany({
    where: {
      OR: [
        { serviceName: { startsWith: "QA Approval " } },
        { subscriptionId: { in: subIds } },
      ],
    },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);
  const entityIds = [...appIds, ...subIds, ...requestIds];
  await prisma.$transaction([
    prisma.notification.deleteMany({
      where: {
        OR: [
          { title: { contains: "QA Approval " } },
          { title: { contains: "QA Vendor " } },
          { body: { contains: "QA Approval " } },
          { body: { contains: "QA Vendor " } },
          ...requestIds.map((id) => ({ link: { contains: id } })),
        ],
      },
    }),
    prisma.auditLog.deleteMany({ where: { entityId: { in: entityIds } } }),
    prisma.approvalRequest.deleteMany({ where: { id: { in: requestIds } } }),
    prisma.subscription.deleteMany({ where: { id: { in: subIds } } }),
    prisma.app.deleteMany({ where: { id: { in: appIds } } }),
    prisma.savedView.deleteMany({
      where: { name: { startsWith: "QA view " } },
    }),
  ]);
}
