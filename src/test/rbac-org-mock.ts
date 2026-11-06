// src/test/rbac-org-mock.ts
/**
 * Test double for `@/lib/rbac/service` for suites that mock
 * `@/lib/auth/require-auth` (not `@/lib/auth`). Permissions are the
 * SYSTEM_ROLE_TEMPLATES grants of the mocked session / organisation role;
 * fixtures without a role behave as administrators.
 *
 *   vi.mock("@/lib/rbac/service", async () =>
 *     (await import("@/test/rbac-org-mock")).orgRbacMock()
 *   );
 */
import * as requireAuth from "@/lib/auth/require-auth";
import {
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";

export class ForbiddenError extends Error {}

interface Actor {
  userId: string;
  organizationId: string | null;
  role: string;
}

type AnyFn = (...args: unknown[]) => Promise<unknown>;

/** Reads a mocked export; vitest throws for exports the factory left out. */
function mockedExport(name: string): AnyFn | null {
  try {
    const fn = (requireAuth as unknown as Record<string, unknown>)[name];
    return typeof fn === "function" ? (fn as AnyFn) : null;
  } catch {
    return null;
  }
}

async function actor(): Promise<Actor | null> {
  const getSession = mockedExport("getCachedSession");
  if (getSession) {
    const session = (await getSession()) as {
      user?: { id: string; organizationId?: string | null; role?: string };
    } | null;
    if (session?.user) {
      return {
        userId: session.user.id,
        organizationId: session.user.organizationId ?? null,
        role: session.user.role ?? "ADMIN",
      };
    }
  }
  const requireOrg = mockedExport("requireOrganization");
  if (requireOrg) {
    const ctx = (await requireOrg()) as {
      userId?: string;
      organizationId: string;
      role?: string;
    };
    return {
      userId: ctx.userId ?? "user-1",
      organizationId: ctx.organizationId,
      role: ctx.role ?? "ADMIN",
    };
  }
  return null;
}

async function grants(): Promise<Set<string>> {
  const a = await actor();
  if (!a) return new Set();
  return new Set(SYSTEM_ROLE_TEMPLATES[a.role as SystemRoleKey]?.grants ?? []);
}

function holds(set: Set<string>, needed: string | string[], any = false) {
  const list = Array.isArray(needed) ? needed : [needed];
  return any ? list.some((k) => set.has(k)) : list.every((k) => set.has(k));
}

export function orgRbacMock() {
  const requirePermission = async (
    needed: string | string[],
    options: { mode?: "all" | "any" } = {}
  ) => {
    const a = await actor();
    const set = await grants();
    if (!a || !holds(set, needed, options.mode === "any")) {
      throw new ForbiddenError(String(needed));
    }
    return { ...a, permissions: set };
  };
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    can: async (needed: string | string[], mode: "all" | "any" = "all") =>
      holds(await grants(), needed, mode === "any"),
    getUserPermissionSet: async () => grants(),
    requirePermission,
    requirePermissionOrRedirect: requirePermission,
  };
}
