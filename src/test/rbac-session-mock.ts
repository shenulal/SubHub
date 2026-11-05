// src/test/rbac-session-mock.ts
/**
 * Test double for `@/lib/rbac/service` that derives permissions from the mocked
 * `auth()` session's system role (SYSTEM_ROLE_TEMPLATES). Fixtures without a
 * `role` behave as administrators, which matches the pre-RBAC test fixtures.
 *
 *   vi.mock("@/lib/rbac/service", async () =>
 *     (await import("@/test/rbac-session-mock")).sessionRbacMock()
 *   );
 */
import { auth } from "@/lib/auth";
import {
  SYSTEM_ROLE_TEMPLATES,
  type SystemRoleKey,
} from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

interface MockSession {
  user?: { id: string; organizationId?: string | null; role?: string };
}

export class ForbiddenError extends Error {}

async function sessionGrants() {
  const session = (await (auth as unknown as () => Promise<unknown>)()) as
    | MockSession
    | null
    | undefined;
  if (!session?.user) return null;
  const role = (session.user.role ?? "ADMIN") as SystemRoleKey;
  const grants = SYSTEM_ROLE_TEMPLATES[role]?.grants ?? [];
  return { session, role, set: new Set<string>(grants) };
}

function hasNeeded(set: Set<string>, needed: string | string[], any = false) {
  const list = Array.isArray(needed) ? needed : [needed];
  return any ? list.some((k) => set.has(k)) : list.every((k) => set.has(k));
}

export function sessionRbacMock() {
  return {
    ForbiddenError,
    isForbiddenError: (e: unknown) => e instanceof ForbiddenError,
    can: async (needed: string | string[], mode: "all" | "any" = "all") => {
      const ctx = await sessionGrants();
      return ctx ? hasNeeded(ctx.set, needed, mode === "any") : false;
    },
    requirePermission: async (
      needed: string | string[],
      options: { mode?: "all" | "any" } = {}
    ) => {
      const ctx = await sessionGrants();
      if (!ctx) redirect("/login");
      const user = ctx!.session.user!;
      if (!user.organizationId) redirect("/onboarding");
      if (!hasNeeded(ctx!.set, needed, options.mode === "any")) {
        throw new ForbiddenError(String(needed));
      }
      return {
        userId: user.id,
        organizationId: user.organizationId,
        role: ctx!.role,
        permissions: ctx!.set,
      };
    },
  };
}
