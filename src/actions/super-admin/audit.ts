// src/actions/super-admin/audit.ts
"use server";

/** Control Panel — platform audit log with filters and pagination. */
import { prisma } from "@/lib/db";
import { getSystemSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import { z } from "zod";
import { platformAction } from "./_action";
import {
  buildAuditWhere,
  hydrateAuditRows,
  type PlatformAuditRow,
} from "./_audit-query";

const filterSchema = z.object({
  action: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]{1,63}$/)
    .optional()
    .or(z.literal("")),
  entityType: z
    .string()
    .regex(/^[A-Za-z]{1,40}$/)
    .optional()
    .or(z.literal("")),
  actorId: z.string().max(64).optional().or(z.literal("")),
  organizationId: z.string().max(64).optional().or(z.literal("")),
  from: z.string().date().optional().or(z.literal("")),
  to: z.string().date().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
});

export type PlatformAuditQuery = z.input<typeof filterSchema>;

export interface PlatformAuditPage {
  rows: PlatformAuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

const endOfDay = (d: string) => new Date(`${d}T23:59:59.999Z`);

async function _listPlatformAudit(
  _actor: unknown,
  query: PlatformAuditQuery = {}
): Promise<ActionState<PlatformAuditPage>> {
  const parsed = filterSchema.safeParse(query);
  if (!parsed.success) return { success: false, error: "Invalid filters" };
  const f = parsed.data;
  const where = buildAuditWhere({
    action: f.action || undefined,
    entityType: f.entityType || undefined,
    actorId: f.actorId || undefined,
    organizationId: f.organizationId || undefined,
    from: f.from ? new Date(`${f.from}T00:00:00.000Z`) : undefined,
    to: f.to ? endOfDay(f.to) : undefined,
  });
  const pageSize = await getSystemSetting("system.platformAuditPageSize");
  const [total, rows] = await Promise.all([
    prisma.platformAuditLog.count({ where }),
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    success: true,
    data: { rows: await hydrateAuditRows(rows), total, page: f.page, pageSize },
  };
}

export const listPlatformAudit = platformAction(
  "listPlatformAudit",
  _listPlatformAudit
);

export interface PlatformAuditFacets {
  actions: string[];
  entityTypes: string[];
  actors: { id: string; label: string }[];
  tenants: { id: string; name: string }[];
}

/** Values for the filter dropdowns (only what actually occurs in the log). */
async function _getPlatformAuditFacets(): Promise<
  ActionState<PlatformAuditFacets>
> {
  const [actions, entityTypes, actorRows, tenants] = await Promise.all([
    prisma.platformAuditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.platformAuditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.platformAuditLog.findMany({
      distinct: ["actorId"],
      where: { actorId: { not: null } },
      select: { actorId: true },
    }),
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const actorIds = actorRows
    .map((r) => r.actorId)
    .filter((v): v is string => !!v);
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  return {
    success: true,
    data: {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.entityType),
      actors: actors.map((a) => ({
        id: a.id,
        label: a.name ? `${a.name} (${a.email})` : a.email,
      })),
      tenants,
    },
  };
}

export const getPlatformAuditFacets = platformAction(
  "getPlatformAuditFacets",
  _getPlatformAuditFacets
);
