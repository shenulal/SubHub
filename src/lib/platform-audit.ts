// src/lib/platform-audit.ts
/**
 * Audit trail for platform-level changes (tenant lifecycle, platform-wide masters).
 * When the actor works inside an organisation the entry goes to that
 * organisation's audit log as before; a SUPER_ADMIN acting from the platform
 * console (no organisation) is recorded in `platform_audit_logs`.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export interface PlatformAuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export async function writePlatformAudit(
  entry: PlatformAuditEntry,
  db: Db = prisma
): Promise<void> {
  await db.platformAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      changes: entry.changes,
      metadata: entry.metadata,
    },
  });
}

/**
 * Record a change to platform-wide data: organisation audit log when the actor
 * has an organisation, platform audit log otherwise.
 */
export async function auditPlatformChange(
  actor: { userId: string; organizationId: string | null },
  entry: Omit<PlatformAuditEntry, "actorId">,
  db: Db = prisma
): Promise<void> {
  if (actor.organizationId) {
    await db.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        changes: entry.changes,
        metadata: entry.metadata,
      },
    });
    return;
  }
  await writePlatformAudit({ ...entry, actorId: actor.userId }, db);
}
