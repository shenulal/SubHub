// src/lib/auth/sign-in-options.test.ts
import { prisma } from "@/lib/db";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSignInOptions } from "./sign-in-options";

vi.mock("@/lib/db", () => ({
  prisma: { organization: { findFirst: vi.fn(), count: vi.fn() } },
}));
vi.mock("@/lib/settings/service", () => ({
  getSetting: vi.fn(),
  getSystemSetting: vi.fn(),
}));
vi.mock("./index", () => ({ isAppleSignInEnabled: () => false }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const orgSetting = vi.mocked(getSetting);
const systemSetting = vi.mocked(getSystemSetting);

beforeEach(() => {
  vi.clearAllMocks();
  db.organization.count.mockResolvedValue(3);
  systemSetting.mockImplementation(
    async (key: string) =>
      (key === "system.allowSelfSignup" ? true : false) as never
  );
  orgSetting.mockResolvedValue(true as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("getSignInOptions", () => {
  it("saas: uses the platform value and never reads the first organisation", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    const options = await getSignInOptions();
    expect(db.organization.findFirst).not.toHaveBeenCalled();
    expect(orgSetting).not.toHaveBeenCalled();
    expect(systemSetting).toHaveBeenCalledWith("security.enforceSso");
    expect(options).toEqual({
      appleEnabled: false,
      enforceSso: false,
      allowSelfSignup: true,
    });
  });

  it("saas: uses the organisation of an invitation or claimed domain when known", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    const options = await getSignInOptions({ organizationId: "org-acme" });
    expect(orgSetting).toHaveBeenCalledWith("org-acme", "security.enforceSso");
    expect(options.enforceSso).toBe(true);
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("single-tenant: the installation's organisation decides", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    db.organization.findFirst.mockResolvedValue({ id: "org-1", name: "QA" });
    const options = await getSignInOptions();
    expect(orgSetting).toHaveBeenCalledWith("org-1", "security.enforceSso");
    expect(options.enforceSso).toBe(true);
  });

  it("single-tenant first run: platform value, sign-up open even if self-signup is off", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    db.organization.findFirst.mockResolvedValue(null);
    db.organization.count.mockResolvedValue(0);
    systemSetting.mockResolvedValue(false as never);
    const options = await getSignInOptions();
    expect(orgSetting).not.toHaveBeenCalled();
    expect(options).toMatchObject({ enforceSso: false, allowSelfSignup: true });
  });
});
