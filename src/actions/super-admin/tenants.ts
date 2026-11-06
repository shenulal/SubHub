// src/actions/super-admin/tenants.ts
"use server";

/**
 * Control Panel — tenant directory and tenant detail (read side). Platform
 * super admins only. Soft-deleted tenants are never listed.
 */
import { prisma } from "@/lib/db";
import { getInstallationId, getLicense } from "@/lib/licensing";
import { getSettings } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { platformAction } from "./_action";
import { listPlatformAuditFor, type PlatformAuditRow } from "./_audit-query";

export interface TenantDirectoryRow {
  id: string;
  name: string;
  domain: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  userCount: number;
  adminCount: number;
  subscriptionCount: number;
  lastActivityAt: Date | null;
}

const directoryFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["all", "active", "suspended"]).default("all"),
});

export type TenantDirectoryFilters = z.input<typeof directoryFilterSchema>;

function directoryWhere(
  filters: z.output<typeof directoryFilterSchema>
): Prisma.OrganizationWhereInput {
  const where: Prisma.OrganizationWhereInput = { deletedAt: null };
  if (filters.status === "active") where.deactivatedAt = null;
  if (filters.status === "suspended") where.deactivatedAt = { not: null };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { domain: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

/** Latest sign-in and admin count per organisation, keyed by id. */
async function activityByOrganization(ids: string[]) {
  if (ids.length === 0) return { lastLogin: new Map(), admins: new Map() };
  const [logins, admins] = await Promise.all([
    prisma.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids } },
      _max: { lastLoginAt: true },
    }),
    prisma.user.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: ids }, role: "ADMIN" },
      _count: { _all: true },
    }),
  ]);
  return {
    lastLogin: new Map(
      logins.map((r) => [r.organizationId, r._max.lastLoginAt])
    ),
    admins: new Map(admins.map((r) => [r.organizationId, r._count._all])),
  };
}

async function _listTenantDirectory(
  _actor: unknown,
  filters: TenantDirectoryFilters = {}
): Promise<ActionState<TenantDirectoryRow[]>> {
  const parsed = directoryFilterSchema.safeParse(filters);
  if (!parsed.success) return { success: false, error: "Invalid filters" };
  const rows = await prisma.organization.findMany({
    where: directoryWhere(parsed.data),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      domain: true,
      createdAt: true,
      deactivatedAt: true,
      _count: { select: { users: true, subscriptions: true } },
    },
  });
  const activity = await activityByOrganization(rows.map((r) => r.id));
  return {
    success: true,
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      createdAt: r.createdAt,
      deactivatedAt: r.deactivatedAt,
      userCount: r._count.users,
      subscriptionCount: r._count.subscriptions,
      adminCount: activity.admins.get(r.id) ?? 0,
      lastActivityAt: activity.lastLogin.get(r.id) ?? null,
    })),
  };
}

export const listTenantDirectory = platformAction(
  "listTenantDirectory",
  _listTenantDirectory
);

export interface TenantAdminRow {
  id: string;
  name: string | null;
  email: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface TenantDetail {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  lastActivityAt: Date | null;
  usersByRole: { role: string; count: number }[];
  usage: {
    users: number;
    activeUsers: number;
    subscriptions: number;
    activeSubscriptions: number;
    apps: number;
    teams: number;
    integrations: number;
  };
  defaults: { countryCode: string; baseCurrency: string; timezone: string };
  admins: TenantAdminRow[];
  pendingAdminInvitations: { id: string; email: string; expiresAt: Date }[];
  licence: { edition: string; maxUsersPerTenant: number | null };
  audit: PlatformAuditRow[];
}

/** Recent platform audit entries shown on the tenant detail page. */
const RECENT_AUDIT_ENTRIES = 8;

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function loadUsage(organizationId: string) {
  const where = { organizationId };
  const [
    users,
    activeUsers,
    subscriptions,
    activeSubscriptions,
    apps,
    teams,
    integrations,
  ] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.subscription.count({ where }),
    prisma.subscription.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.app.count({ where }),
    prisma.team.count({ where }),
    prisma.integration.count({ where }),
  ]);
  return {
    users,
    activeUsers,
    subscriptions,
    activeSubscriptions,
    apps,
    teams,
    integrations,
  };
}

async function loadPeople(organizationId: string) {
  const [byRole, admins, invitations, lastLogin] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { organizationId, role: "ADMIN" },
      orderBy: { createdAt: "asc" },
      select: ADMIN_SELECT,
    }),
    prisma.invitation.findMany({
      where: { organizationId, role: "ADMIN", status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, expiresAt: true },
    }),
    prisma.user.aggregate({
      where: { organizationId },
      _max: { lastLoginAt: true },
    }),
  ]);
  return {
    usersByRole: byRole.map((r) => ({ role: r.role, count: r._count._all })),
    admins,
    pendingAdminInvitations: invitations,
    lastActivityAt: lastLogin._max.lastLoginAt,
  };
}

async function _getTenantDetail(
  _actor: unknown,
  organizationId: string
): Promise<ActionState<TenantDetail>> {
  if (typeof organizationId !== "string" || !organizationId) {
    return { success: false, error: "Select a tenant." };
  }
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      domain: true,
      logoUrl: true,
      createdAt: true,
      deactivatedAt: true,
    },
  });
  if (!org) return { success: false, error: "Tenant information not found." };
  const [usage, people, settings, license, audit] = await Promise.all([
    loadUsage(org.id),
    loadPeople(org.id),
    getSettings(org.id, [
      "general.countryCode",
      "finance.baseCurrency",
      "general.timezone",
    ]),
    getLicense(),
    listPlatformAuditFor(org.id, RECENT_AUDIT_ENTRIES),
  ]);
  return {
    success: true,
    data: {
      ...org,
      ...people,
      usage,
      defaults: {
        countryCode: settings["general.countryCode"],
        baseCurrency: settings["finance.baseCurrency"],
        timezone: settings["general.timezone"],
      },
      licence: {
        edition: license.edition,
        maxUsersPerTenant: license.limits.maxUsersPerTenant,
      },
      audit,
    },
  };
}

export const getTenantDetail = platformAction(
  "getTenantDetail",
  _getTenantDetail
);

/** Single-tenant: the installation ID and its organisation (oldest, not deleted). */
async function _getInstallationTenantId(): Promise<
  ActionState<{ organizationId: string | null; installationId: string }>
> {
  const [org, installationId] = await Promise.all([
    prisma.organization.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    getInstallationId(),
  ]);
  return {
    success: true,
    data: { organizationId: org?.id ?? null, installationId },
  };
}

export const getInstallationTenantId = platformAction(
  "getInstallationTenantId",
  _getInstallationTenantId
);
