// src/actions/super-admin/_audit-query.ts
/**
 * Read model for `platform_audit_logs`: rows with actor and tenant names and an
 * English description. Shared by the Audit page and the tenant detail page.
 * Not a server action module.
 */
import { describeAuditAction } from "@/lib/audit/describe-action";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface PlatformAuditRow {
  id: string;
  createdAt: Date;
  action: string;
  description: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; name: string | null; email: string } | null;
  tenant: { id: string; name: string } | null;
  changes: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
}

export interface PlatformAuditFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  organizationId?: string;
  from?: Date;
  to?: Date;
}

type RawRow = Prisma.PlatformAuditLogGetPayload<object>;

function tenantIdOf(row: RawRow): string | null {
  if (row.entityType === "Organization" && row.entityId) return row.entityId;
  const meta = row.metadata as { organizationId?: unknown } | null;
  return typeof meta?.organizationId === "string" ? meta.organizationId : null;
}

export function tenantAuditWhere(
  organizationId: string
): Prisma.PlatformAuditLogWhereInput {
  return {
    OR: [
      { entityType: "Organization", entityId: organizationId },
      { metadata: { path: ["organizationId"], equals: organizationId } },
    ],
  };
}

export function buildAuditWhere(
  f: PlatformAuditFilters
): Prisma.PlatformAuditLogWhereInput {
  const and: Prisma.PlatformAuditLogWhereInput[] = [];
  if (f.action) and.push({ action: f.action });
  if (f.entityType) and.push({ entityType: f.entityType });
  if (f.actorId) and.push({ actorId: f.actorId });
  if (f.organizationId) and.push(tenantAuditWhere(f.organizationId));
  if (f.from || f.to) {
    and.push({
      createdAt: {
        ...(f.from ? { gte: f.from } : {}),
        ...(f.to ? { lte: f.to } : {}),
      },
    });
  }
  return and.length > 0 ? { AND: and } : {};
}

/** Attach actor and tenant names to raw rows (two batched lookups). */
export async function hydrateAuditRows(
  rows: RawRow[]
): Promise<PlatformAuditRow[]> {
  const actorIds = [
    ...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v)),
  ];
  const tenantIds = [
    ...new Set(rows.map(tenantIdOf).filter((v): v is string => !!v)),
  ];
  const [actors, tenants] = await Promise.all([
    actorIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    tenantIds.length
      ? prisma.organization.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const actorMap = new Map(actors.map((a) => [a.id, a]));
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  return rows.map((r) => {
    const tenantId = tenantIdOf(r);
    return {
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      description: describeAuditAction(r.action),
      entityType: r.entityType,
      entityId: r.entityId,
      actor: r.actorId ? (actorMap.get(r.actorId) ?? null) : null,
      tenant: tenantId ? (tenantMap.get(tenantId) ?? null) : null,
      changes: r.changes,
      metadata: r.metadata,
    };
  });
}

export async function listPlatformAuditFor(
  organizationId: string,
  take: number
): Promise<PlatformAuditRow[]> {
  const rows = await prisma.platformAuditLog.findMany({
    where: tenantAuditWhere(organizationId),
    orderBy: { createdAt: "desc" },
    take,
  });
  return hydrateAuditRows(rows);
}
