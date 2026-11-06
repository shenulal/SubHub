// src/test/platform-session-mock.ts
/**
 * Helpers for Control Panel tests. Pair with:
 *   vi.mock("@/lib/auth/require-auth", () => ({ getCachedSession: vi.fn() }));
 *   vi.mock("@/lib/platform/platform-user", () => ({ loadPlatformUser: vi.fn() }));
 * The real `@/lib/platform/guard` then decides access from these two mocks.
 */
import { getCachedSession } from "@/lib/auth/require-auth";
import { loadPlatformUser } from "@/lib/platform/platform-user";
import { vi } from "vitest";

export interface FakeUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  organizationId: string | null;
}

export const SUPER_ADMIN: FakeUser = {
  id: "sa-1",
  email: "ops@platform.test",
  name: "Platform Ops",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  organizationId: null,
};

export const TENANT_ADMIN: FakeUser = {
  id: "ta-1",
  email: "admin@tenant.test",
  name: "Tenant Admin",
  role: "ADMIN",
  status: "ACTIVE",
  organizationId: "org-1",
};

export const TENANT_MEMBER: FakeUser = {
  ...TENANT_ADMIN,
  id: "tm-1",
  role: "MEMBER",
};

/** Make `user` the signed-in user (null = signed out). */
export function signInAs(user: FakeUser | null) {
  vi.mocked(getCachedSession).mockResolvedValue(
    (user
      ? {
          user: {
            id: user.id,
            role: user.role,
            organizationId: user.organizationId,
          },
        }
      : null) as never
  );
  vi.mocked(loadPlatformUser).mockResolvedValue(user as never);
}

export const TEST_POLICY = {
  minLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
  historyCount: 3,
};
