// src/actions/apps-form-options.ts
"use server";

/**
 * Pick lists for creating an app (full page and quick-create dialog): active
 * members as possible owners, teams, and the icon size limit from settings.
 * Requires `apps:manage` (the same permission that creates apps).
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";

export interface AppFormOptions {
  owners: { id: string; name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  logoMaxSizeKb: number;
}

async function _getAppFormOptions(): Promise<ActionState<AppFormOptions>> {
  try {
    const { organizationId } = await requirePermission("apps:manage");
    const [owners, teams, logoMaxSizeKb] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      }),
      prisma.team.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getSetting(organizationId, "documents.appLogoMaxSizeKb"),
    ]);
    return { success: true, data: { owners, teams, logoMaxSizeKb } };
  } catch (error) {
    if (isForbiddenError(error)) {
      return { success: false, error: error.message, message: "FORBIDDEN" };
    }
    const digest = (error as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
    logger.error({ err: error }, "[apps] form options failed");
    return { success: false, error: "Could not load the form options" };
  }
}
export const getAppFormOptions = withLogging(
  "getAppFormOptions",
  _getAppFormOptions
);
