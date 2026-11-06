// src/actions/apps.ts
"use server";

import { resolveAppCategory } from "@/actions/apps-category";
import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import {
  getUserPermissionSet,
  isForbiddenError,
  requirePermission,
} from "@/lib/rbac/service";
import {
  deleteManagedLogo,
  isAppLogoError,
  resolveLogoInput,
} from "@/lib/services/app-logo";
import { matchPaymentsToNewApp } from "@/lib/services/payment/payment-matching";
import type { ActionState, PaginatedResponse } from "@/types";
import type {
  AppDetail,
  AppFilterOptions,
  AppListItem,
  AppSortOptions,
} from "@/types/app";
import { AppStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function isRedirectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const hasRedirectDigest =
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.includes("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.includes("NEXT_NOT_FOUND"));

  const hasRedirectMessage = error.message?.includes("NEXT_REDIRECT") ?? false;

  return hasRedirectDigest || hasRedirectMessage;
}

/**
 * Server-side guard for app writes (`apps:manage`). Returns the caller's scope,
 * or null when the permission is missing; redirects when signed out.
 */
async function requireAppsManage(): Promise<{
  organizationId: string;
  userId: string;
} | null> {
  try {
    const { organizationId, userId } = await requirePermission("apps:manage");
    return { organizationId, userId };
  } catch (error) {
    if (isForbiddenError(error)) return null;
    throw error;
  }
}

type LogoResult =
  | { ok: true; url: string | null }
  | { ok: false; state: ActionState<never> };

/**
 * Uploaded icons (data URLs) are validated and moved to storage; URLs are
 * checked. An unchanged value (`current`) is kept without re-processing.
 */
async function resolveLogoField(
  organizationId: string,
  raw: string | null | undefined,
  current?: string | null
): Promise<LogoResult> {
  const value = raw?.trim() || null;
  if (current !== undefined && value === current) {
    return { ok: true, url: current };
  }
  try {
    return { ok: true, url: await resolveLogoInput(organizationId, value) };
  } catch (error) {
    if (!isAppLogoError(error)) throw error;
    return {
      ok: false,
      state: {
        success: false,
        message: error.message,
        errors: { customLogoUrl: [error.message] },
      },
    };
  }
}

// Validate a URL or a relative path (starting with /)
const isValidUrlOrPath = (val: string | null | undefined) => {
  if (!val || val === "") return true;
  if (val.startsWith("/")) return true; // allow relative paths
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
};

// Validation schemas
const createAppSchema = z.object({
  name: z
    .string()
    .min(2, "App name must be at least 2 characters")
    .max(100, "App name must be 100 characters or fewer"),
  category: z.string().nullish(),
  categoryId: z.string().nullish(),
  customLogoUrl: z
    .string()
    .nullish()
    .refine(isValidUrlOrPath, { message: "Please enter a valid URL" }),
  customWebsite: z
    .string()
    .url("Please enter a valid URL")
    .nullish()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or fewer")
    .nullish(),
  tags: z.string().nullish(),
  ownerId: z.string().nullish(),
  catalogId: z.string().nullish(),
  teamIds: z.array(z.string()).optional(),
});

const updateAppSchema = createAppSchema.extend({
  status: z.nativeEnum(AppStatus).nullish(),
});

interface GetAppsParams {
  filter?: AppFilterOptions;
  sort?: AppSortOptions;
  page?: number;
  limit?: number;
}

/**
 * App visibility follows permissions, not the legacy role: users who may read
 * every subscription (subscriptions:read_all) see every app; everyone else sees
 * the apps assigned to their team. Custom roles are honoured.
 */
async function appVisibility() {
  const { organizationId, userId, teamId } = await requireOrganization();
  const permissions = await getUserPermissionSet(userId, organizationId);
  return {
    organizationId,
    teamId,
    orgWide: permissions.has("subscriptions:read_all"),
  };
}

/**
 * List apps
 */
export async function getApps(
  params: GetAppsParams = {}
): Promise<PaginatedResponse<AppListItem>> {
  const { organizationId, teamId, orgWide } = await appVisibility();

  const {
    filter = {},
    sort = { sortBy: "createdAt", sortOrder: "desc" },
    page = 1,
    limit = 20,
  } = params;

  // Team-scoped users without a team see nothing
  if (!orgWide) {
    if (!teamId) {
      // No team membership: return an empty result
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
  }

  const skip = (page - 1) * limit;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { organizationId };

  // Team-scoped users only see apps assigned to their team
  if (!orgWide && teamId) {
    where.teams = { some: { teamId } };
  }

  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.source) {
    where.source = filter.source;
  }
  if (filter.category) {
    where.category = filter.category;
  }
  if (filter.ownerId) {
    where.ownerId = filter.ownerId;
  }
  if (filter.search) {
    where.name = { contains: filter.search, mode: "insensitive" };
  }
  // Only ADMIN may use the teamIds filter (MEMBER/VIEWER are already limited to their teams)
  if (orgWide && filter.teamIds && filter.teamIds.length > 0) {
    where.teams = {
      some: { teamId: { in: filter.teamIds } },
    };
  }

  // Build orderBy
  const orderBy = sort.sortBy
    ? { [sort.sortBy]: sort.sortOrder || "desc" }
    : { createdAt: "desc" as const };

  const [apps, total] = await Promise.all([
    prisma.app.findMany({
      where,
      include: {
        catalog: { select: { logoUrl: true, category: true } },
        owner: { select: { name: true, email: true } },
        teams: { include: { team: { select: { id: true, name: true } } } },
        _count: { select: { subscriptions: true, userAccesses: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.app.count({ where }),
  ]);

  const items: AppListItem[] = apps.map((app) => ({
    id: app.id,
    name: app.name,
    status: app.status,
    source: app.source,
    category: app.category || app.catalog?.category || null,
    customLogoUrl: app.customLogoUrl,
    catalogLogoUrl: app.catalog?.logoUrl ?? null,
    ownerName: app.owner?.name ?? null,
    ownerEmail: app.owner?.email ?? null,
    subscriptionCount: app._count.subscriptions,
    userAccessCount: app._count.userAccesses,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    teams: app.teams.map((at) => ({ id: at.team.id, name: at.team.name })),
  }));

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get app details
 */
export async function getApp(id: string): Promise<AppDetail | null> {
  const { organizationId, teamId, orgWide } = await appVisibility();

  const app = await prisma.app.findFirst({
    where: { id, organizationId },
    include: {
      catalog: { select: { logoUrl: true, category: true } },
      owner: { select: { name: true, email: true } },
      teams: { include: { team: { select: { id: true, name: true } } } },
      _count: { select: { subscriptions: true, userAccesses: true } },
    },
  });

  if (!app) {
    return null;
  }

  // Team-scoped users can only see apps assigned to their team
  if (!orgWide) {
    const isTeamApp = teamId && app.teams.some((at) => at.teamId === teamId);
    if (!isTeamApp) {
      return null; // No access → treat as Not Found
    }
  }

  return {
    id: app.id,
    name: app.name,
    status: app.status,
    source: app.source,
    category: app.category || app.catalog?.category || null,
    categoryId: app.categoryId,
    catalogId: app.catalogId,
    customLogoUrl: app.customLogoUrl,
    catalogLogoUrl: app.catalog?.logoUrl ?? null,
    customWebsite: app.customWebsite,
    notes: app.notes,
    tags: app.tags,
    riskScore: app.riskScore,
    discoveredAt: app.discoveredAt,
    ownerName: app.owner?.name ?? null,
    ownerEmail: app.owner?.email ?? null,
    subscriptionCount: app._count.subscriptions,
    userAccessCount: app._count.userAccesses,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
    teams: app.teams.map((at) => ({ id: at.team.id, name: at.team.name })),
  };
}

/**
 * Create app
 */
async function _createApp(
  _prevState: ActionState<{ id: string; matchedPaymentCount?: number }>,
  formData: FormData
): Promise<
  ActionState<{
    id: string;
    matchedPaymentCount?: number;
    customLogoUrl?: string | null;
  }>
> {
  try {
    const scope = await requireAppsManage();
    if (!scope) {
      return {
        success: false,
        message: "You do not have permission to create apps",
      };
    }
    const { organizationId, userId } = scope;

    // Parse form data
    const teamIdsRaw = formData.getAll("teamIds") as string[];
    const rawData = {
      name: formData.get("name") as string,
      category: formData.get("category") as string | null,
      categoryId: formData.get("categoryId") as string | null,
      customLogoUrl: formData.get("customLogoUrl") as string | null,
      customWebsite: formData.get("customWebsite") as string | null,
      notes: formData.get("notes") as string | null,
      tags: formData.get("tags") as string | null,
      ownerId: formData.get("ownerId") as string | null,
      catalogId: formData.get("catalogId") as string | null,
      teamIds: teamIdsRaw.filter(Boolean),
    };

    // Validate
    const result = createAppSchema.safeParse(rawData);
    if (!result.success) {
      return {
        success: false,
        errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const data = result.data;

    // Check for duplicate name
    const existingApp = await prisma.app.findFirst({
      where: { organizationId, name: data.name },
    });

    if (existingApp) {
      return {
        success: false,
        message: "An app with this name already exists",
      };
    }

    // Validate ownerId belongs to same organization
    if (data.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: data.ownerId, organizationId },
      });
      if (!owner) {
        return {
          success: false,
          message: "The specified owner does not belong to this organization",
        };
      }
    }

    // Validate teamIds belong to same organization
    if (data.teamIds && data.teamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: data.teamIds }, organizationId },
      });
      if (teams.length !== data.teamIds.length) {
        return {
          success: false,
          message: "One or more teams are invalid",
        };
      }
    }

    // Parse tags
    const tags = data.tags
      ? data.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const categoryRef = await resolveAppCategory(
      organizationId,
      data.categoryId,
      data.category
    );
    if (!categoryRef.ok) {
      return { success: false, message: categoryRef.message };
    }

    const logo = await resolveLogoField(organizationId, data.customLogoUrl);
    if (!logo.ok) return logo.state;

    // Create app
    const app = await prisma.app.create({
      data: {
        name: data.name,
        category: categoryRef.category,
        categoryId: categoryRef.categoryId,
        customLogoUrl: logo.url,
        customWebsite: data.customWebsite || null,
        notes: data.notes || null,
        tags,
        ownerId: data.ownerId || null,
        catalogId: data.catalogId || null,
        organizationId,
      },
    });

    // Create AppTeam records
    if (data.teamIds && data.teamIds.length > 0) {
      await prisma.appTeam.createMany({
        data: data.teamIds.map((teamId) => ({
          appId: app.id,
          teamId,
          assignedBy: userId,
        })),
      });
    }

    // Match existing payment records to the new app
    let matchedPaymentCount = 0;
    try {
      const matchResult = await matchPaymentsToNewApp(
        app.id,
        app.name,
        organizationId
      );
      matchedPaymentCount = matchResult.matchedCount;
    } catch (error) {
      // Log but don't fail app creation (graceful degradation)
      logger.warn({ err: error }, "Payment matching error");
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE_APP",
        entityType: "App",
        entityId: app.id,
        userId,
        organizationId,
        metadata: {
          appName: app.name,
          matchedPaymentCount,
          customLogoUrl: logo.url,
          ownerId: app.ownerId,
          teamIds: data.teamIds ?? [],
        },
      },
    });

    revalidatePath("/apps");

    return {
      success: true,
      data: {
        id: app.id,
        matchedPaymentCount,
        customLogoUrl: app.customLogoUrl,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "App creation error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while creating the app",
    };
  }
}
export const createApp = withLogging("createApp", _createApp);

/**
 * Update app
 */
async function _updateApp(
  id: string,
  _prevState: ActionState<{ id: string }>,
  formData: FormData
): Promise<ActionState<{ id: string }>> {
  try {
    const scope = await requireAppsManage();
    if (!scope) {
      return {
        success: false,
        message: "You do not have permission to edit this app",
      };
    }
    const { organizationId, userId } = scope;

    // Check if app exists
    const existingApp = await prisma.app.findFirst({
      where: { id, organizationId },
    });

    if (!existingApp) {
      return { success: false, message: "App not found" };
    }

    // Parse form data
    const teamIdsRaw = formData.getAll("teamIds") as string[];
    const rawData = {
      name: formData.get("name") as string,
      status: formData.get("status") as AppStatus | null,
      category: formData.get("category") as string | null,
      categoryId: formData.get("categoryId") as string | null,
      customLogoUrl: formData.get("customLogoUrl") as string | null,
      customWebsite: formData.get("customWebsite") as string | null,
      notes: formData.get("notes") as string | null,
      tags: formData.get("tags") as string | null,
      ownerId: formData.get("ownerId") as string | null,
      teamIds: teamIdsRaw.filter(Boolean),
    };

    // Validate
    const result = updateAppSchema.safeParse(rawData);
    if (!result.success) {
      return {
        success: false,
        errors: result.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const data = result.data;

    // Check for duplicate name (if name changed)
    if (data.name !== existingApp.name) {
      const duplicateApp = await prisma.app.findFirst({
        where: { organizationId, name: data.name, id: { not: id } },
      });

      if (duplicateApp) {
        return {
          success: false,
          message: "An app with this name already exists",
        };
      }
    }

    // Validate ownerId belongs to same organization
    if (data.ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: data.ownerId, organizationId },
      });
      if (!owner) {
        return {
          success: false,
          message: "The specified owner does not belong to this organization",
        };
      }
    }

    // Validate teamIds belong to same organization
    if (data.teamIds && data.teamIds.length > 0) {
      const teams = await prisma.team.findMany({
        where: { id: { in: data.teamIds }, organizationId },
      });
      if (teams.length !== data.teamIds.length) {
        return {
          success: false,
          message: "One or more teams are invalid",
        };
      }
    }

    // Parse tags
    const tags = data.tags
      ? data.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    // Category master wins when the client sends categoryId; otherwise the
    // legacy free-text category is kept as before.
    const categoryRef = formData.has("categoryId")
      ? await resolveAppCategory(
          organizationId,
          data.categoryId,
          // Clearing a master-linked category also clears its mirrored name.
          existingApp.categoryId && !data.categoryId ? null : data.category
        )
      : null;
    if (categoryRef && !categoryRef.ok) {
      return { success: false, message: categoryRef.message };
    }

    const logo = await resolveLogoField(
      organizationId,
      data.customLogoUrl,
      existingApp.customLogoUrl
    );
    if (!logo.ok) return logo.state;

    // Update app
    const app = await prisma.app.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status || existingApp.status,
        ...(categoryRef?.ok
          ? {
              category: categoryRef.category,
              categoryId: categoryRef.categoryId,
            }
          : { category: data.category || null }),
        customLogoUrl: logo.url,
        customWebsite: data.customWebsite || null,
        notes: data.notes || null,
        tags,
        // Forms without an owner field must not clear the existing owner.
        ownerId: formData.has("ownerId")
          ? data.ownerId || null
          : existingApp.ownerId,
      },
    });

    // Sync AppTeam records (delete existing and recreate)
    await prisma.appTeam.deleteMany({
      where: { appId: id },
    });

    if (data.teamIds && data.teamIds.length > 0) {
      await prisma.appTeam.createMany({
        data: data.teamIds.map((teamId) => ({
          appId: id,
          teamId,
          assignedBy: userId,
        })),
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "UPDATE_APP",
        entityType: "App",
        entityId: app.id,
        userId,
        organizationId,
        metadata: {
          appName: app.name,
          ...(logo.url !== existingApp.customLogoUrl
            ? {
                customLogoUrl: {
                  from: existingApp.customLogoUrl,
                  to: logo.url,
                },
              }
            : {}),
        },
      },
    });
    if (logo.url !== existingApp.customLogoUrl) {
      await deleteManagedLogo(existingApp.customLogoUrl);
    }

    revalidatePath("/apps");
    revalidatePath(`/apps/${id}`);

    return { success: true, data: { id: app.id } };
  } catch (error) {
    logger.error({ err: error }, "App update error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while updating the app",
    };
  }
}
export const updateApp = withLogging("updateApp", _updateApp);

/**
 * Delete app
 */
async function _deleteApp(id: string): Promise<ActionState> {
  try {
    const scope = await requireAppsManage();
    if (!scope) {
      return {
        success: false,
        message: "You do not have permission to delete apps",
      };
    }
    const { organizationId, userId } = scope;

    // Check if app exists
    const existingApp = await prisma.app.findFirst({
      where: { id, organizationId },
    });

    if (!existingApp) {
      return { success: false, message: "App not found" };
    }

    // Delete app (cascade will delete related subscriptions and user accesses)
    await prisma.app.delete({ where: { id } });
    await deleteManagedLogo(existingApp.customLogoUrl);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "DELETE_APP",
        entityType: "App",
        entityId: id,
        userId,
        organizationId,
        metadata: { appName: existingApp.name },
      },
    });

    revalidatePath("/apps");

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "App deletion error");
    if (isRedirectError(error)) throw error;
    return {
      success: false,
      message: "An error occurred while deleting the app",
    };
  }
}
export const deleteApp = withLogging("deleteApp", _deleteApp);
