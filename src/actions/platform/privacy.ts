// src/actions/platform/privacy.ts
"use server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { deleteObject, getSignedUrl, putObject } from "@/lib/services/storage";
import { getSettings } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { DataExportRow } from "@/types/platform";
import { revalidatePath } from "next/cache";
import { ActionError, toActionError, toIso, writeAudit } from "./_shared";
import {
  buildUserExportBundle,
  EXPORT_CONTENT_TYPE,
  EXPORT_FORMAT,
} from "./privacy-bundle";

const PRIVACY_PATH = "/settings/privacy";
const MS_PER_HOUR = 3_600_000;
const MS_PER_SECOND = 1000;
const MAX_LISTED_EXPORTS = 20;

export interface PrivacyContext {
  allowSelfDeletion: boolean;
  exportExpiryHours: number;
}

function exportKey(
  organizationId: string,
  userId: string,
  requestId: string
): string {
  return `org/${organizationId}/exports/${userId}/${requestId}.zip`;
}

async function _getPrivacyContext(): Promise<ActionState<PrivacyContext>> {
  try {
    const { organizationId } = await requirePermission("settings:read");
    const s = await getSettings(organizationId, [
      "privacy.allowSelfDeletion",
      "privacy.dataExportExpiryHours",
    ]);
    return {
      success: true,
      data: {
        allowSelfDeletion: s["privacy.allowSelfDeletion"],
        exportExpiryHours: s["privacy.dataExportExpiryHours"],
      },
    };
  } catch (error) {
    return toActionError(error, "getPrivacyContext");
  }
}
export const getPrivacyContext = withLogging(
  "getPrivacyContext",
  _getPrivacyContext
);

async function _requestDataExport(): Promise<ActionState<{ id: string }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("data:export_own");
    const pending = await prisma.dataExportRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) throw new ActionError("An export is already being prepared");
    const { "privacy.dataExportExpiryHours": expiryHours } = await getSettings(
      organizationId,
      ["privacy.dataExportExpiryHours"]
    );
    const request = await prisma.dataExportRequest.create({
      data: { organizationId, userId, format: EXPORT_FORMAT },
    });
    const key = exportKey(organizationId, userId, request.id);
    try {
      const now = new Date();
      const bundle = await buildUserExportBundle(organizationId, userId, now);
      const stored = await putObject(key, bundle.zip, EXPORT_CONTENT_TYPE);
      await prisma.dataExportRequest.update({
        where: { id: request.id },
        data: {
          status: "READY",
          storageKey: stored.key,
          sizeBytes: stored.sizeBytes,
          completedAt: now,
          expiresAt: new Date(now.getTime() + expiryHours * MS_PER_HOUR),
        },
      });
    } catch (error) {
      logger.error(
        { err: error, requestId: request.id },
        "[privacy] export build failed"
      );
      await prisma.dataExportRequest.update({
        where: { id: request.id },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Export failed",
        },
      });
      throw new ActionError(
        "We could not build your export. Please try again later."
      );
    }
    await writeAudit({
      organizationId,
      userId,
      action: "REQUEST_DATA_EXPORT",
      entityType: "DataExportRequest",
      entityId: request.id,
    });
    revalidatePath(PRIVACY_PATH);
    return { success: true, data: { id: request.id } };
  } catch (error) {
    return toActionError(error, "requestDataExport");
  }
}
export const requestDataExport = withLogging(
  "requestDataExport",
  _requestDataExport
);

async function expireIfNeeded(
  row: {
    id: string;
    status: string;
    expiresAt: Date | null;
    storageKey: string | null;
  },
  now: Date
): Promise<boolean> {
  if (
    row.status !== "READY" ||
    !row.expiresAt ||
    row.expiresAt.getTime() > now.getTime()
  )
    return false;
  await prisma.dataExportRequest.update({
    where: { id: row.id },
    data: { status: "EXPIRED", fileUrl: null },
  });
  if (row.storageKey) {
    try {
      await deleteObject(row.storageKey);
    } catch (err) {
      logger.warn(
        { err, key: row.storageKey },
        "[privacy] could not delete expired export"
      );
    }
  }
  return true;
}

async function _listMyDataExports(): Promise<ActionState<DataExportRow[]>> {
  try {
    const { userId } = await requirePermission("data:export_own");
    const now = new Date();
    const rows = await prisma.dataExportRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      take: MAX_LISTED_EXPORTS,
    });
    const out: DataExportRow[] = [];
    for (const row of rows) {
      const expired = await expireIfNeeded(row, now);
      const status = expired ? "EXPIRED" : row.status;
      let downloadUrl: string | null = null;
      if (status === "READY" && row.storageKey && row.expiresAt) {
        const ttl = Math.max(
          1,
          Math.floor((row.expiresAt.getTime() - now.getTime()) / MS_PER_SECOND)
        );
        downloadUrl = await getSignedUrl(row.storageKey, ttl);
      }
      out.push({
        id: row.id,
        status,
        format: row.format,
        sizeBytes: row.sizeBytes,
        requestedAt: row.requestedAt.toISOString(),
        completedAt: toIso(row.completedAt),
        expiresAt: toIso(row.expiresAt),
        downloadUrl,
        errorMessage: row.errorMessage,
      });
    }
    return { success: true, data: out };
  } catch (error) {
    return toActionError(error, "listMyDataExports");
  }
}
export const listMyDataExports = withLogging(
  "listMyDataExports",
  _listMyDataExports
);
