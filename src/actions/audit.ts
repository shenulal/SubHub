// src/actions/audit.ts
"use server";

/**
 * Audit log Server Actions
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

import type {
  AuditLogEntry,
  AuditLogExportEntry,
  AuditLogFilterOptions,
  AuditLogFilters,
  AuditLogListResponse,
} from "@/types/audit";

function buildAuditLogWhere(
  filters: AuditLogFilters,
  sessionUser: {
    id: string;
    role?: string | null;
    organizationId: string;
  }
) {
  const where: Record<string, unknown> = {
    organizationId: sessionUser.organizationId,
  };

  if (sessionUser.role === "MEMBER") {
    where.userId = sessionUser.id;
    return where;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.teamId && sessionUser.role === "ADMIN") {
    where.user = { teamId: filters.teamId };
  }

  if (filters.action) {
    // The action filter may include detailed codes such as CREATE_APP or CREATE_SUBSCRIPTION,
    // so match on the category prefix (e.g. CREATE).
    where.action = { startsWith: filters.action };
  }

  if (filters.entityType) {
    where.entityType = filters.entityType;
  }

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
 * Access: ADMIN sees all, MEMBER sees own entries only, VIEWER denied
 */
export async function getAuditLogs(
  filters: AuditLogFilters
): Promise<AuditLogListResponse> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const { role, id: userId } = session.user;

  // VIEWER cannot access audit logs
  if (role === "VIEWER") {
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
    role,
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

  if (session.user.role === "VIEWER") {
    return [];
  }

  const where = buildAuditLogWhere(filters, {
    id: session.user.id,
    role: session.user.role,
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
 * Access: ADMIN sees all, MEMBER sees own entries only, VIEWER denied
 */
export async function getAuditLogById(
  id: string
): Promise<AuditLogEntry | null> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  const { role, id: userId } = session.user;

  // VIEWER cannot access audit logs
  if (role === "VIEWER") {
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

  // MEMBER can only view their own entries
  if (role === "MEMBER" && log.userId !== userId) {
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
 * Access: ADMIN/MEMBER only, VIEWER denied
 */
export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const session = await auth();
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  // VIEWER cannot access audit logs
  if (session.user.role === "VIEWER") {
    return { actions: [], entityTypes: [], users: [], teams: [] };
  }

  const organizationId = session.user.organizationId;
  const isAdmin = session.user.role === "ADMIN";

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
