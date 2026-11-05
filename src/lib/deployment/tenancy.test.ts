// src/lib/deployment/tenancy.test.ts
import { prisma } from "@/lib/db";
import { getSystemSetting } from "@/lib/settings/service";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOrganizationCreationAllowed,
  canCreateOrganization,
  emailDomain,
  findDomainJoinOrganization,
  getOnboardingState,
  getSingleTenantOrganization,
  isSignupOpen,
  SELF_SIGNUP_DISABLED_MESSAGE,
  SINGLE_TENANT_LIMIT_MESSAGE,
  TenancyError,
} from "./tenancy";

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { count: vi.fn(), findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));
vi.mock("@/lib/settings/service", () => ({ getSystemSetting: vi.fn() }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;
const systemSetting = vi.mocked(getSystemSetting);

function selfSignup(enabled: boolean) {
  systemSetting.mockImplementation(async (key: string) =>
    key === "system.allowSelfSignup" ? enabled : (undefined as never)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  selfSignup(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("single-tenant mode (default)", () => {
  beforeEach(() => vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant"));

  it("allows creating the first organisation even when self-signup is off", async () => {
    selfSignup(false);
    db.organization.count.mockResolvedValue(0);
    expect(await canCreateOrganization({ viaSelfSignup: true })).toEqual({
      allowed: true,
    });
  });

  it("refuses a second organisation", async () => {
    db.organization.count.mockResolvedValue(1);
    expect(await canCreateOrganization({ viaSelfSignup: false })).toEqual({
      allowed: false,
      reason: SINGLE_TENANT_LIMIT_MESSAGE,
    });
  });

  it("locks and re-checks inside the creating transaction", async () => {
    db.organization.count.mockResolvedValue(1);
    await expect(
      assertOrganizationCreationAllowed(db, { viaSelfSignup: true })
    ).rejects.toBeInstanceOf(TenancyError);
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("resolves the installation's organisation", async () => {
    db.organization.findFirst.mockResolvedValue({ id: "org-1", name: "QA" });
    expect(await getSingleTenantOrganization()).toEqual({
      id: "org-1",
      name: "QA",
    });
  });

  it("auto-joins by primary or additional domain when self-signup is on", async () => {
    db.organization.findFirst.mockResolvedValue({
      id: "org-1",
      name: "QA",
      domain: "qa.ae",
      settings: { domains: ["qa-group.com"] },
      deactivatedAt: null,
    });
    expect(await findDomainJoinOrganization("a@QA.ae")).toEqual({
      id: "org-1",
      name: "QA",
    });
    expect(await findDomainJoinOrganization("b@qa-group.com")).toEqual({
      id: "org-1",
      name: "QA",
    });
    expect(await findDomainJoinOrganization("c@other.com")).toBeNull();
  });

  it("does not auto-join when self-signup is off", async () => {
    selfSignup(false);
    expect(await findDomainJoinOrganization("a@qa.ae")).toBeNull();
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("onboarding: first-run create, then invite-only", async () => {
    db.user.findUnique.mockResolvedValue({
      email: "a@x.com",
      organization: null,
    });
    db.organization.findFirst.mockResolvedValue(null);
    db.organization.count.mockResolvedValue(0);
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "create",
      firstRun: true,
    });

    db.organization.findFirst.mockResolvedValue({
      id: "org-1",
      name: "QA",
      domain: "qa.ae",
      settings: {},
      deactivatedAt: null,
    });
    db.organization.count.mockResolvedValue(1);
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "invite-only",
      reason: "installation-ready",
    });
  });

  it("sign-up form is open during first-run setup only (self-signup off)", async () => {
    selfSignup(false);
    db.organization.count.mockResolvedValue(0);
    expect(await isSignupOpen()).toBe(true);
    db.organization.count.mockResolvedValue(1);
    expect(await isSignupOpen()).toBe(false);
  });
});

describe("saas mode", () => {
  beforeEach(() => vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas"));

  it("lets a new customer create their own organisation with self-signup", async () => {
    db.organization.count.mockResolvedValue(25);
    expect(await canCreateOrganization({ viaSelfSignup: true })).toEqual({
      allowed: true,
    });
    await expect(
      assertOrganizationCreationAllowed(db, { viaSelfSignup: true })
    ).resolves.toBeUndefined();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it("refuses self-service creation when self-signup is off, not platform creation", async () => {
    selfSignup(false);
    expect(await canCreateOrganization({ viaSelfSignup: true })).toEqual({
      allowed: false,
      reason: SELF_SIGNUP_DISABLED_MESSAGE,
    });
    expect(await canCreateOrganization({ viaSelfSignup: false })).toEqual({
      allowed: true,
    });
  });

  it("never treats the first organisation as the installation's", async () => {
    expect(await getSingleTenantOrganization()).toBeNull();
    expect(db.organization.findFirst).not.toHaveBeenCalled();
  });

  it("auto-joins only the active organisation that claimed the domain", async () => {
    db.organization.findFirst.mockResolvedValue({ id: "org-9", name: "Acme" });
    expect(await findDomainJoinOrganization("x@acme.com")).toEqual({
      id: "org-9",
      name: "Acme",
    });
    expect(db.organization.findFirst).toHaveBeenCalledWith({
      where: {
        domain: { equals: "acme.com", mode: "insensitive" },
        deactivatedAt: null,
      },
      select: { id: true, name: true },
    });
  });

  it("onboarding: join, create, signup-closed and deactivated", async () => {
    db.user.findUnique.mockResolvedValue({
      email: "x@acme.com",
      organization: null,
    });
    db.organization.findFirst.mockResolvedValueOnce({
      id: "org-9",
      name: "Acme",
    });
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "join",
      organization: { id: "org-9", name: "Acme" },
    });

    db.organization.findFirst.mockResolvedValueOnce(null);
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "create",
      firstRun: false,
    });

    selfSignup(false);
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "invite-only",
      reason: "signup-closed",
    });

    db.user.findUnique.mockResolvedValue({
      email: "x@acme.com",
      organization: { name: "Acme", deactivatedAt: new Date() },
    });
    expect(await getOnboardingState("u-1")).toEqual({
      kind: "deactivated",
      organizationName: "Acme",
    });
  });
});

describe("emailDomain", () => {
  it("extracts a lower-case domain", () => {
    expect(emailDomain("A@Example.COM")).toBe("example.com");
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain(null)).toBeNull();
  });
});
