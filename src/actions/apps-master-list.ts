// src/actions/apps-master-list.ts
"use server";

/**
 * Paged app list for Master data → Apps. Same visibility rules as the Apps
 * page (`getApps`), gated by `apps:read`, page size from the
 * `discovery.listPageSize` setting so it matches the App catalog list.
 */
import { getApps } from "@/actions/apps";
import { toActionError, validationFailure } from "@/actions/taxonomy/_shared";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { getSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { AppListItem } from "@/types/app";
import { AppStatus } from "@prisma/client";
import { z } from "zod";

export interface AppsMasterPage {
  items: AppListItem[];
  total: number;
  page: number;
  pageSize: number;
}

const MAX_QUERY_LENGTH = 100;

const appsMasterQuerySchema = z.object({
  query: z.string().trim().max(MAX_QUERY_LENGTH).default(""),
  status: z.union([z.literal("all"), z.nativeEnum(AppStatus)]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export type AppsMasterQuery = z.input<typeof appsMasterQuerySchema>;

async function _listAppsForMasters(
  raw: AppsMasterQuery = {}
): Promise<ActionState<AppsMasterPage>> {
  try {
    const { organizationId } = await requirePermission("apps:read");
    const parsed = appsMasterQuerySchema.safeParse(raw ?? {});
    if (!parsed.success) return validationFailure(parsed.error);
    const { query, status, page } = parsed.data;
    const pageSize = await getSetting(organizationId, "discovery.listPageSize");
    const result = await getApps({
      filter: {
        ...(query ? { search: query } : {}),
        ...(status !== "all" ? { status } : {}),
      },
      sort: { sortBy: "name", sortOrder: "asc" },
      page,
      limit: pageSize,
    });
    return {
      success: true,
      data: { items: result.items, total: result.total, page, pageSize },
    };
  } catch (error) {
    return toActionError(error, "listAppsForMasters");
  }
}

export const listAppsForMasters = withLogging(
  "listAppsForMasters",
  _listAppsForMasters
);
