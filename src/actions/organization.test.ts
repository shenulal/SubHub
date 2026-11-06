// src/actions/organization.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rbac/service", async () =>
  (await import("@/test/rbac-session-mock")).sessionRbacMock()
);
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    organization: { findFirst: vi.fn(), count: vi.fn() },
    role: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/masters/organization-defaults", () => ({
  ensureOrganizationDefaults: vi.fn(),
}));

vi.mock("@/lib/settings/service", () => ({
  getSystemSetting: vi.fn(),
  getSetting: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect mock - Next.js redirect throws NEXT_REDIRECT error
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`NEXT_REDIRECT:${url}`);
    error.name = "NEXT_REDIRECT";
    throw error;
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import { createOrganization, joinOrganizationByDomain } from "./organization";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedAuth = auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function form(name = "Test Organization", domain = "test.ae") {
  const fd = new FormData();
  fd.set("name", name);
  fd.set("domain", domain);
  return fd;
}

/** Transaction double: `count` is what the in-transaction re-check sees. */
function mockTransaction(orgCount: number) {
  const tx = {
    $executeRaw: vi.fn(),
    organization: {
      count: vi.fn().mockResolvedValue(orgCount),
      create: vi.fn().mockResolvedValue({ id: "new-org-id" }),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn() },
  };
  db.$transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) =>
    fn(tx)
  );
  return tx;
}

function signedIn(organizationId: string | null = null, email = "a@test.ae") {
  mockedAuth.mockResolvedValue({ user: { id: "user-1", email }, expires: "" });
  db.user.findUnique.mockResolvedValue({ organizationId, email });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.organization.findFirst.mockResolvedValue(null);
  vi.mocked(getSystemSetting).mockResolvedValue(true as never);
});
afterEach(() => vi.unstubAllEnvs());

describe("createOrganization", () => {
  describe("authentication and validation", () => {
    it("redirects an unauthenticated user to the login page", async () => {
      mockedAuth.mockResolvedValue(null);
      await expect(createOrganization(form())).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("redirects when the session has no user.id", async () => {
      mockedAuth.mockResolvedValue({ user: { id: "" }, expires: "" });
      await expect(createOrganization(form())).rejects.toThrow(
        "NEXT_REDIRECT:/login"
      );
    });

    it("returns a validation error for a short name or a missing domain", async () => {
      signedIn();
      const short = await createOrganization(form("A"));
      expect(short).toMatchObject({ success: false });
      expect(short.error).toMatch(/at least 2 characters/);
      const noDomain = await createOrganization(form("Valid", ""));
      expect(noDomain).toMatchObject({ success: false });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a user who already belongs to an organization", async () => {
      signedIn("existing-org-id");
      expect(await createOrganization(form())).toEqual({
        success: false,
        error: "You already belong to an organization",
      });
    });

    it("refuses a domain another organisation uses", async () => {
      signedIn();
      db.organization.findFirst.mockResolvedValue({ id: "other" });
      expect(await createOrganization(form())).toEqual({
        success: false,
        error: "This domain is already in use",
      });
    });
  });

  describe("single-tenant mode", () => {
    beforeEach(() => vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant"));

    it("first-run setup: creates the organisation, makes the user ADMIN and seeds defaults", async () => {
      signedIn();
      const tx = mockTransaction(0);
      await expect(createOrganization(form())).rejects.toThrow(
        "NEXT_REDIRECT:/dashboard"
      );
      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.organization.create).toHaveBeenCalledWith({
        data: { name: "Test Organization", domain: "test.ae" },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { organizationId: "new-org-id", role: "ADMIN" },
      });
      expect(ensureOrganizationDefaults).toHaveBeenCalledWith("new-org-id", {
        db: tx,
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CREATE_ORGANIZATION" }),
        })
      );
    });

    it("blocks a second organisation once the installation is set up", async () => {
      signedIn();
      const tx = mockTransaction(1);
      const result = await createOrganization(form());
      expect(result).toEqual({
        success: false,
        error:
          "This installation already has an organisation. Ask its administrator for an invitation.",
      });
      expect(tx.organization.create).not.toHaveBeenCalled();
    });
  });

  describe("saas mode", () => {
    beforeEach(() => vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas"));

    it("creates a new organisation for a new customer when self-signup is allowed", async () => {
      signedIn();
      const tx = mockTransaction(42);
      await expect(
        createOrganization(form("Acme", "acme.com"))
      ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(tx.organization.create).toHaveBeenCalledWith({
        data: { name: "Acme", domain: "acme.com" },
      });
    });

    it("refuses self-service creation when self-signup is disabled", async () => {
      signedIn();
      vi.mocked(getSystemSetting).mockResolvedValue(false as never);
      const tx = mockTransaction(42);
      const result = await createOrganization(form("Acme", "acme.com"));
      expect(result).toMatchObject({ success: false });
      expect(result.error).toMatch(/disabled/);
      expect(tx.organization.create).not.toHaveBeenCalled();
    });
  });
});

describe("joinOrganizationByDomain", () => {
  it("joins the organisation that claimed the email domain with its default role (saas)", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    vi.mocked(getSetting).mockResolvedValue("MEMBER" as never);
    signedIn(null, "new@acme.com");
    db.organization.findFirst.mockResolvedValue({
      id: "org-acme",
      name: "Acme",
    });
    const tx = mockTransaction(5);
    await expect(joinOrganizationByDomain()).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard"
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", organizationId: null },
      data: { organizationId: "org-acme", role: "MEMBER", roleId: null },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "JOIN_ORGANIZATION_BY_DOMAIN",
          metadata: { domain: "acme.com", role: "MEMBER", roleId: null },
        }),
      })
    );
  });

  it("uses a custom default role, and never auto-grants ADMIN", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    db.organization.findFirst.mockResolvedValue({
      id: "org-acme",
      name: "Acme",
    });
    db.role.findFirst.mockResolvedValue({ id: "role-analyst" });

    vi.mocked(getSetting).mockResolvedValue("custom_analyst" as never);
    signedIn(null, "a@acme.com");
    let tx = mockTransaction(5);
    await expect(joinOrganizationByDomain()).rejects.toThrow("NEXT_REDIRECT");
    expect(tx.user.updateMany.mock.calls[0][0].data).toEqual({
      organizationId: "org-acme",
      role: "MEMBER",
      roleId: "role-analyst",
    });

    vi.mocked(getSetting).mockResolvedValue("ADMIN" as never);
    db.role.findFirst.mockResolvedValue(null);
    signedIn(null, "b@acme.com");
    tx = mockTransaction(5);
    await expect(joinOrganizationByDomain()).rejects.toThrow("NEXT_REDIRECT");
    expect(tx.user.updateMany.mock.calls[0][0].data.role).toBe("MEMBER");
    expect(tx.user.updateMany.mock.calls[0][0].data.roleId).toBeNull();
  });

  it("refuses when no organisation accepts the domain", async () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    signedIn(null, "new@nowhere.com");
    db.organization.findFirst.mockResolvedValue(null);
    expect(await joinOrganizationByDomain()).toEqual({
      success: false,
      error: "No organisation accepts sign-ups from your email domain.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a user who already has an organisation", async () => {
    signedIn("org-1");
    expect(await joinOrganizationByDomain()).toMatchObject({ success: false });
  });
});
