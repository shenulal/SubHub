// src/lib/services/approval/audit.ts
/**
 * Every approval event is persisted twice: as an `ApprovalEvent` (timeline) and
 * as an `AuditLog` row (`APPROVAL_REQUEST_<TYPE>`, entityType "approval_request")
 * so the export / compliance views see the same history.
 */
import { prisma } from "@/lib/db";
import type { ApprovalEventType, Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export const APPROVAL_ENTITY_TYPE = "approval_request";

export interface RecordEventInput {
  organizationId: string;
  requestId: string;
  actorId: string | null;
  type: ApprovalEventType;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}

export function auditActionFor(type: ApprovalEventType): string {
  return `APPROVAL_REQUEST_${type}`;
}

export async function recordApprovalEvent(
  db: Db,
  input: RecordEventInput
): Promise<void> {
  const metadata = (input.metadata ?? undefined) as
    | Prisma.InputJsonValue
    | undefined;
  await db.approvalEvent.create({
    data: {
      requestId: input.requestId,
      actorId: input.actorId,
      type: input.type,
      comment: input.comment ?? null,
      metadata,
    },
  });
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.actorId,
      action: auditActionFor(input.type),
      entityType: APPROVAL_ENTITY_TYPE,
      entityId: input.requestId,
      changes: {
        comment: input.comment ?? null,
        ...(input.metadata ?? {}),
      } as Prisma.InputJsonValue,
    },
  });
}

export async function recordAudit(
  db: Db,
  input: {
    organizationId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    changes?: Record<string, unknown>;
  }
): Promise<void> {
  await db.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: (input.changes ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}
