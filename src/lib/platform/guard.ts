// src/lib/platform/guard.ts
/**
 * Server-side guard for the Platform Control Panel. Only an ACTIVE super admin
 * without an organisation passes; tenant users (including tenant ADMINs) are
 * refused. Pages render a 403 / redirect; actions get `PlatformAccessError`.
 */
import { getCachedSession } from "@/lib/auth/require-auth";
import { ForbiddenError } from "@/lib/rbac/service";
import { isPlatformSuperAdmin, SUPER_ADMIN_ROLE } from "./identity";
import { loadPlatformUser } from "./platform-user";

export interface PlatformAdminActor {
  userId: string;
  email: string;
  name: string | null;
}

export type PlatformAccess =
  | { status: "ok"; actor: PlatformAdminActor }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "disabled" }
  /** Temporary password set by another admin: change it first. */
  | { status: "password_change" };

export type PlatformDenial = Exclude<PlatformAccess["status"], "ok">;

const DENIAL_MESSAGES: Record<PlatformDenial, string> = {
  unauthenticated: "Sign in to the Control Panel first.",
  forbidden: "Only platform super administrators can use the Control Panel.",
  disabled: "This platform administrator account is disabled.",
  password_change:
    "Change your temporary password before using the Control Panel.",
};

export class PlatformAccessError extends ForbiddenError {
  constructor(public readonly reason: PlatformDenial) {
    super("platform:super_admin", DENIAL_MESSAGES[reason]);
    this.name = "PlatformAccessError";
  }
}

export function isPlatformAccessError(e: unknown): e is PlatformAccessError {
  return e instanceof PlatformAccessError;
}

/** Resolve the current session against the database (no redirects, no throws). */
export async function getPlatformAccess(): Promise<PlatformAccess> {
  const session = await getCachedSession();
  if (!session?.user?.id) return { status: "unauthenticated" };
  if ((session.user.role as string) !== SUPER_ADMIN_ROLE) {
    return { status: "forbidden" };
  }
  const user = await loadPlatformUser(session.user.id);
  if (!user || !isPlatformSuperAdmin(user)) return { status: "forbidden" };
  if (user.status !== "ACTIVE") return { status: "disabled" };
  if (session.user.mustChangePassword) return { status: "password_change" };
  return {
    status: "ok",
    actor: { userId: user.id, email: user.email, name: user.name },
  };
}

/** Action guard: returns the actor or throws `PlatformAccessError`. */
export async function requirePlatformAdmin(): Promise<PlatformAdminActor> {
  const access = await getPlatformAccess();
  if (access.status !== "ok") throw new PlatformAccessError(access.status);
  return access.actor;
}
