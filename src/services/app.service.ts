// src/services/app.service.ts
// SMP-203: App CRUD business logic — service layer shared by Server Actions and the Write Tool

import { prisma } from "@/lib/db";
import { matchPaymentsToNewApp } from "@/lib/services/payment/payment-matching";
import { ctxHasPermission } from "./service-permissions";

// ==================== Types ====================

export interface AppServiceContext {
  organizationId: string;
  userId: string;
  /** Legacy role (informational; checks use RBAC permissions). */
  role: string;
  permissions?: ReadonlySet<string>;
  teamId?: string;
}

export interface CreateAppInput {
  name: string;
  category?: string | null;
  customLogoUrl?: string | null;
  customWebsite?: string | null;
  notes?: string | null;
  tags?: string | null;
  ownerId?: string | null;
  catalogId?: string | null;
  teamIds?: string[];
}

export interface UpdateAppInput {
  name?: string;
  category?: string | null;
  customLogoUrl?: string | null;
  customWebsite?: string | null;
  notes?: string | null;
  tags?: string | null;
  ownerId?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "PENDING_REVIEW" | "BLOCKED";
  teamIds?: string[];
}

export interface ServiceResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

// ==================== Create ====================

export async function createApp(
  ctx: AppServiceContext,
  input: CreateAppInput
): Promise<ServiceResult<{ id: string; matchedPaymentCount?: number }>> {
  // Permission check
  if (!(await ctxHasPermission(ctx, "apps:manage"))) {
    return {
      success: false,
      message: "You do not have permission to create apps",
    };
  }

  // Duplicate name check
  const existingApp = await prisma.app.findFirst({
    where: { organizationId: ctx.organizationId, name: input.name },
  });
  if (existingApp) {
    return { success: false, message: "An app with this name already exists" };
  }

  // Validate ownerId
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: { id: input.ownerId, organizationId: ctx.organizationId },
    });
    if (!owner) {
      return {
        success: false,
        message: "The specified owner does not belong to this organization",
      };
    }
  }

  // Validate teamIds
  if (input.teamIds && input.teamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: input.teamIds }, organizationId: ctx.organizationId },
    });
    if (teams.length !== input.teamIds.length) {
      return {
        success: false,
        message: "One or more teams are invalid",
      };
    }
  }

  // Parse tags
  const tags = input.tags
    ? input.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Create the app
  const app = await prisma.app.create({
    data: {
      name: input.name,
      category: input.category || null,
      customLogoUrl: input.customLogoUrl || null,
      customWebsite: input.customWebsite || null,
      notes: input.notes || null,
      tags,
      ownerId: input.ownerId || null,
      catalogId: input.catalogId || null,
      organizationId: ctx.organizationId,
    },
  });

  // Create AppTeam records
  if (input.teamIds && input.teamIds.length > 0) {
    await prisma.appTeam.createMany({
      data: input.teamIds.map((teamId) => ({
        appId: app.id,
        teamId,
        assignedBy: ctx.userId,
      })),
    });
  }

  // Payment matching
  let matchedPaymentCount = 0;
  try {
    const matchResult = await matchPaymentsToNewApp(
      app.id,
      app.name,
      ctx.organizationId
    );
    matchedPaymentCount = matchResult.matchedCount;
  } catch {
    // App creation still succeeds if this fails
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "CREATE_APP",
      entityType: "App",
      entityId: app.id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { appName: app.name, matchedPaymentCount },
    },
  });

  return { success: true, data: { id: app.id, matchedPaymentCount } };
}

// ==================== Update ====================

export async function updateApp(
  ctx: AppServiceContext,
  id: string,
  input: UpdateAppInput
): Promise<ServiceResult<{ id: string }>> {
  // Permission check
  if (!(await ctxHasPermission(ctx, "apps:manage"))) {
    return {
      success: false,
      message: "You do not have permission to edit this app",
    };
  }

  // Ensure the app exists
  const existingApp = await prisma.app.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existingApp) {
    return { success: false, message: "App not found" };
  }

  // Duplicate name check (when renaming)
  if (input.name && input.name !== existingApp.name) {
    const duplicateApp = await prisma.app.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: input.name,
        id: { not: id },
      },
    });
    if (duplicateApp) {
      return {
        success: false,
        message: "An app with this name already exists",
      };
    }
  }

  // Validate ownerId
  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: { id: input.ownerId, organizationId: ctx.organizationId },
    });
    if (!owner) {
      return {
        success: false,
        message: "The specified owner does not belong to this organization",
      };
    }
  }

  // Validate teamIds
  if (input.teamIds && input.teamIds.length > 0) {
    const teams = await prisma.team.findMany({
      where: { id: { in: input.teamIds }, organizationId: ctx.organizationId },
    });
    if (teams.length !== input.teamIds.length) {
      return {
        success: false,
        message: "One or more teams are invalid",
      };
    }
  }

  // Parse tags
  const tags = input.tags
    ? input.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Update the app
  const app = await prisma.app.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      status: input.status || existingApp.status,
      category:
        input.category !== undefined ? input.category || null : undefined,
      customLogoUrl:
        input.customLogoUrl !== undefined
          ? input.customLogoUrl || null
          : undefined,
      customWebsite:
        input.customWebsite !== undefined
          ? input.customWebsite || null
          : undefined,
      notes: input.notes !== undefined ? input.notes || null : undefined,
      ...(input.tags !== undefined && { tags }),
      ownerId: input.ownerId !== undefined ? input.ownerId || null : undefined,
    },
  });

  // Sync AppTeam records
  if (input.teamIds !== undefined) {
    await prisma.appTeam.deleteMany({ where: { appId: id } });
    if (input.teamIds.length > 0) {
      await prisma.appTeam.createMany({
        data: input.teamIds.map((teamId) => ({
          appId: id,
          teamId,
          assignedBy: ctx.userId,
        })),
      });
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "UPDATE_APP",
      entityType: "App",
      entityId: app.id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { appName: app.name },
    },
  });

  return { success: true, data: { id: app.id } };
}

// ==================== Delete ====================

export async function deleteApp(
  ctx: AppServiceContext,
  id: string
): Promise<ServiceResult> {
  // Permission check
  if (!(await ctxHasPermission(ctx, "apps:manage"))) {
    return { success: false, message: "Admin permission required" };
  }

  // Ensure the app exists
  const existingApp = await prisma.app.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!existingApp) {
    return { success: false, message: "App not found" };
  }

  // Delete
  await prisma.app.delete({ where: { id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "DELETE_APP",
      entityType: "App",
      entityId: id,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      metadata: { appName: existingApp.name },
    },
  });

  return { success: true };
}
