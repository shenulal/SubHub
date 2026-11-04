// tests/e2e/helpers.ts
import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export const QA = {
  admin: "qa-admin@subhub-qa.test",
  approver: "qa-approver@subhub-qa.test",
  member: "qa-member@subhub-qa.test",
};

/** Sign in through the NextAuth credentials provider using a seeded one-time code. */
export async function login(page: Page, email: string): Promise<void> {
  const code = "246810";
  await prisma.otpToken.deleteMany({ where: { email } });
  await prisma.otpToken.create({
    data: { email, code, expires: new Date(Date.now() + 3600_000) },
  });
  const csrf = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, otp: code, redirectTo: "/dashboard" },
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
