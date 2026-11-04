// src/actions/discovery/scope.ts
"use server";

/**
 * Workspace | Personal mode (6.4). The active scope is persisted in the
 * `subhub_scope` cookie (fast path for server components) and mirrored into
 * `User.preferences.scope` so it follows the user across devices.
 */
import { getCachedSession, requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  DEFAULT_SCOPE,
  SCOPE_COOKIE,
} from "@/lib/services/discovery/scope-cookie";
import { getSetting } from "@/lib/settings/service";
import { workspaceScopeSchema } from "@/lib/validations/discovery";
import type { ActionState } from "@/types";
import type { WorkspaceScope, WorkspaceScopeState } from "@/types/discovery";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function readPreferenceScope(preferences: unknown): WorkspaceScope | null {
  if (!preferences || typeof preferences !== "object") return null;
  const parsed = workspaceScopeSchema.safeParse(
    (preferences as { scope?: unknown }).scope
  );
  return parsed.success ? parsed.data : null;
}

async function readCookieScope(): Promise<WorkspaceScope | null> {
  try {
    const raw = (await cookies()).get(SCOPE_COOKIE)?.value;
    const parsed = workspaceScopeSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the active scope for the current user. Personal mode is only honoured
 * when the organisation allows personal subscriptions.
 */
export const getWorkspaceScope = withLogging(
  "getWorkspaceScope",
  async (): Promise<WorkspaceScopeState> => {
    const session = await getCachedSession();
    const organizationId = session?.user?.organizationId;
    if (!session?.user || !organizationId) {
      return { scope: DEFAULT_SCOPE, allowPersonal: false };
    }
    const allowPersonal = await getSetting(
      organizationId,
      "subscriptions.allowPersonalSubscriptions"
    );
    if (!allowPersonal) return { scope: DEFAULT_SCOPE, allowPersonal };

    const fromCookie = await readCookieScope();
    if (fromCookie) return { scope: fromCookie, allowPersonal };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    return {
      scope: readPreferenceScope(user?.preferences) ?? DEFAULT_SCOPE,
      allowPersonal,
    };
  }
);

/** Persist the scope in cookie + user preferences and revalidate the app shell. */
export const setWorkspaceScope = withLogging(
  "setWorkspaceScope",
  async (input: unknown): Promise<ActionState<WorkspaceScopeState>> => {
    const parsed = workspaceScopeSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid scope" };
    }
    const session = await requireAuth();
    const organizationId = session.user.organizationId;
    const allowPersonal = organizationId
      ? await getSetting(
          organizationId,
          "subscriptions.allowPersonalSubscriptions"
        )
      : false;
    const scope: WorkspaceScope =
      allowPersonal || parsed.data === DEFAULT_SCOPE
        ? parsed.data
        : DEFAULT_SCOPE;

    try {
      (await cookies()).set(SCOPE_COOKIE, scope, {
        path: "/",
        maxAge: COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
        httpOnly: false,
      });
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      });
      const current =
        user?.preferences && typeof user.preferences === "object"
          ? (user.preferences as Record<string, unknown>)
          : {};
      await prisma.user.update({
        where: { id: session.user.id },
        data: { preferences: { ...current, scope } },
      });
      revalidatePath("/", "layout");
      return { success: true, data: { scope, allowPersonal } };
    } catch (error) {
      logger.error({ err: error }, "[discovery] setWorkspaceScope failed");
      return { success: false, error: "Could not save scope" };
    }
  }
);
