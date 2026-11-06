// src/actions/audit.ts
"use server";

/**
 * Audit log Server Actions
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inFilter, mergeLegacyValue } from "@/lib/filters/multi-value";
import { can } from "@/lib/rbac/service";
import { redirect } from "next/navigation";

import type {
  AuditLogEntry,
  AuditLogExportEntry,
  AuditLogFilterOptions,
  AuditLogFilters,
  AuditLogListResponse,
} from "@/types/audit";

interface AuditAccess {
  /** audit:read — own trail at least */
  allowed: boolean;
  /** audit:read_all — every member's trail */
  canReadAll: boolean;
}

async function resolveAuditAccess(): Promise<AuditAccess> {
  const [allowed, canReadAll] = await Promise.all([
    can("audit:read"),
    can("audit:read_all"),
  ]);
  return { allowed, canReadAll: allowed && canReadAll };
}

function buildAuditLogWhere(
  filters: AuditLogFilters,
  sessionUser: {
    id: string;
    canReadAll: boolean;
    organizationId: string;
  }
) {
  const where: Record<string, unknown> = {
    organizationId: sessionUser.organizationId,
  };

  if (!sessionUser.canReadAll) {
    where.userId = sessionUser.id;
    return where;
  }

  const users = inFilter(mergeLegacyValue(filters.userIds, filters.userId));
  if (users) where.userId = users;

  const teams = inFilter(mergeLegacyValue(filters.teamIds, filters.teamId));
  if (teams) {
    where.user = { teamId: teams };
  }

  // The action filter may include detailed codes such as CREATE_APP or
  // CREATE_SUBSCRIPTION, so each selected category matches as a prefix.
  const actions = mergeLegacyValue(filters.actions, filters.action);
  if (actions?.length === 1) {
    where.action = { startsWith: actions[0] };
  } else if (actions?.length) {
    where.AND = [
      { OR: actions.map((action) => ({ action: { startsWith: action } })) },
    ];
  }

  const entityTypes = inFilter(
    mergeLegacyValue(filters.entityTypes, filters.entityType)
  );
  if (entityTypes) where.entityType = entityTypes;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(
        filters.startDate
      );
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(
        filters.endDate
      );
    }
  }

  if (filters.search) {
    where.OR = [
      { user: { name: { contains: filters.search, mode: "insensitive" } } },
      { user: { email: { contains: filters.search, mode: "insensitive" } } },
      { entityType: { contains: filters.search, mode: "insensitive" } },
      { action: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

// ==================== Server Actions ====================

/**
 * List audit logs (paginated)
 * Access: audit:read_all sees all, audit:read sees own entries, else denied
 */
export async function getAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogListResponse> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const { id: userId } = session.user;
  const access = await resolveAuditAccess();

  // Without audit:read there is nothing to show
  if (!access.allowed) {
    return {
      logs: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
    };
  }

  const organizationId = session.user.organizationId;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = buildAuditLogWhere(filters, {
    id: userId,
    canReadAll: access.canReadAll,
    organizationId,
  });

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userEmail: log.user?.email ?? null,
      changes: log.changes as Record<string, unknown> | null,
      metadata: log.metadata as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/**
 * Get audit log export data (no pagination)
 */
export async function getAuditLogExportData(
  filters: AuditLogFilters
): Promise<AuditLogExportEntry[]> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const access = await resolveAuditAccess();
  if (!access.allowed || !(await can("audit:export"))) {
    return [];
  }

  const where = buildAuditLogWhere(filters, {
    id: session.user.id,
    canReadAll: access.canReadAll,
    organizationId: session.user.organizationId,
  });

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userName: log.user?.name ?? null,
    userEmail: log.user?.email ?? null,
    teamName: log.user?.team?.name ?? null,
    changes: log.changes as Record<string, unknown> | null,
    metadata: log.metadata as Record<string, unknown> | null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));
}

/**
 * Get a single audit log entry
 * Access: audit:read_all sees all, audit:read sees own entries, else denied
 */
export async function getAuditLogById(
  id: string
): Promise<AuditLogEntry | null> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const { id: userId } = session.user;
  const access = await resolveAuditAccess();

  // Without audit:read there is nothing to show
  if (!access.allowed) {
    return null;
  }

  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!log) {
    return null;
  }

  // Verify organization
  if (log.organizationId !== session.user.organizationId) {
    throw new Error("You do not have access permission");
  }

  // Without audit:read_all only own entries are visible
  if (!access.canReadAll && log.userId !== userId) {
    return null;
  }

  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userId: log.userId,
    userName: log.user?.name ?? null,
    userEmail: log.user?.email ?? null,
    changes: log.changes as Record<string, unknown> | null,
    metadata: log.metadata as Record<string, unknown> | null,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  };
}

/**
 * Get filter options (action types, entity types, user list)
 * Access: audit:read (all users/teams with audit:read_all)
 */
export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const access = await resolveAuditAccess();
  if (!access.allowed) {
    return { actions: [], entityTypes: [], users: [], teams: [] };
  }

  const organizationId = session.user.organizationId;
  const isAdmin = access.canReadAll;

  const userWhere = isAdmin ? { organizationId } : { id: session.user.id };

  const teamWhere = isAdmin
    ? { organizationId }
    : session.user.teamId
      ? { id: session.user.teamId }
      : { id: "__none__" };

  // Fetch user list
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      teamId: true,
      team: {
        select: { id: true, name: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const teams = await prisma.team.findMany({
    where: teamWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Static options (a distinct query against the DB is also possible)
  const actions = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "LOGIN",
    "LOGOUT",
    "SYNC",
    "EXPORT",
    "IMPORT",
  ];

  const entityTypes = [
    "App",
    "Subscription",
    "User",
    "Integration",
    "Organization",
    "Payment",
  ];

  return {
    actions,
    entityTypes,
    users: users.map((u) => ({
      id: u.id,
      name: u.name ?? "",
      email: u.email,
      teamId: u.teamId ?? null,
      teamName: u.team?.name ?? null,
    })),
    teams,
  };
}
