// src/lib/platform/guard.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getCachedSession } from "@/lib/auth/require-auth";
import {
  SUPER_ADMIN,
  TENANT_ADMIN,
  TENANT_MEMBER,
  signInAs,
} from "@/test/platform-session-mock";
import {
  getPlatformAccess,
  isPlatformAccessError,
  requirePlatformAdmin,
} from "./guard";
import {
  homeForUserWithoutOrganization,
  isPlatformSuperAdmin,
} from "./identity";

beforeEach(() => vi.clearAllMocks());

describe("getPlatformAccess", () => {
  it("is unauthenticated without a session", async () => {
    signInAs(null);
    expect(await getPlatformAccess()).toEqual({ status: "unauthenticated" });
  });

  it("refuses a tenant ADMIN", async () => {
    signInAs(TENANT_ADMIN);
    expect(await getPlatformAccess()).toEqual({ status: "forbidden" });
  });

  it("refuses a tenant member", async () => {
    signInAs(TENANT_MEMBER);
    expect(await getPlatformAccess()).toEqual({ status: "forbidden" });
  });

  it("refuses a SUPER_ADMIN that belongs to an organisation", async () => {
    signInAs({ ...SUPER_ADMIN, organizationId: "org-1" });
    expect(await getPlatformAccess()).toEqual({ status: "forbidden" });
  });

  it("reports a disabled super admin", async () => {
    signInAs({ ...SUPER_ADMIN, status: "INACTIVE" });
    expect(await getPlatformAccess()).toEqual({ status: "disabled" });
  });

  it("asks for a password change when the session carries a temporary password", async () => {
    signInAs(SUPER_ADMIN);
    vi.mocked(getCachedSession).mockResolvedValue({
      user: {
        id: "sa-1",
        role: "SUPER_ADMIN",
        organizationId: null,
        mustChangePassword: true,
      },
    } as never);
    expect(await getPlatformAccess()).toEqual({ status: "password_change" });
  });

  it("lets an active platform super admin in", async () => {
    signInAs(SUPER_ADMIN);
    expect(await getPlatformAccess()).toEqual({
      status: "ok",
      actor: {
        userId: "sa-1",
        email: SUPER_ADMIN.email,
        name: SUPER_ADMIN.name,
      },
    });
  });
});

describe("requirePlatformAdmin", () => {
  it("throws PlatformAccessError for a tenant ADMIN", async () => {
    signInAs(TENANT_ADMIN);
    const error = await requirePlatformAdmin().catch((e: unknown) => e);
    expect(isPlatformAccessError(error)).toBe(true);
  });
});

describe("identity", () => {
  it("only SUPER_ADMIN without an organisation is a platform admin", () => {
    expect(
      isPlatformSuperAdmin({ role: "SUPER_ADMIN", organizationId: null })
    ).toBe(true);
    expect(
      isPlatformSuperAdmin({ role: "SUPER_ADMIN", organizationId: "o" })
    ).toBe(false);
    expect(isPlatformSuperAdmin({ role: "ADMIN", organizationId: null })).toBe(
      false
    );
  });

  it("sends an org-less super admin to the panel, others to onboarding", () => {
    expect(homeForUserWithoutOrganization("SUPER_ADMIN")).toBe("/super-admin");
    expect(homeForUserWithoutOrganization("ADMIN")).toBe("/onboarding");
  });
});
