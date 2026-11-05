// src/actions/platform/roles-query.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { permissionGroups } from "./roles-query";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/rbac/service", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/rbac/service")>(
      "@/lib/rbac/service"
    );
  return { ...actual, ensureOrganizationRoles: vi.fn() };
});
vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));

const keys = () =>
  permissionGroups().flatMap((g) => g.permissions.map((p) => p.key));

afterEach(() => vi.unstubAllEnvs());

describe("permissionGroups (role editor)", () => {
  it("single-tenant: offers platform permissions to tenant roles", () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "single-tenant");
    expect(keys()).toContain("masters:manage_global");
    expect(keys()).toContain("catalog:manage");
  });

  it("saas: hides platform-only permissions from the grantable list", () => {
    vi.stubEnv("SUBHUB_DEPLOYMENT_MODE", "saas");
    expect(keys()).not.toContain("masters:manage_global");
    expect(keys()).not.toContain("catalog:manage");
    expect(keys()).toContain("masters:manage");
    expect(keys()).toContain("catalog:read");
  });
});
