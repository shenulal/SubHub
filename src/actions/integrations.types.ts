// src/actions/integrations.types.ts
/**
 * Integration types and utilities
 */

import type { IntegrationStatus } from "@prisma/client";

/**
 * Integration list query parameters
 */
export interface GetIntegrationsParams {
  filter?: {
    /** One or several statuses (multi-select; empty = all). */
    status?: IntegrationStatus | IntegrationStatus[];
    type?: string;
    search?: string;
  };
  sort?: {
    sortBy?: "createdAt" | "updatedAt" | "type";
    sortOrder?: "asc" | "desc";
  };
  page?: number;
  limit?: number;
}

/**
 * Sync log entry
 */
export interface SyncLogEntry {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: Array<{ code: string; message: string }> | null;
  startedAt: string; // ISO 8601 string
  completedAt: string | null; // ISO 8601 string
}

/**
 * Integration settings input
 */
export interface IntegrationSettingsInput {
  autoSync?: boolean;
  syncInterval?: "hourly" | "daily" | "weekly";
  syncUsers?: boolean;
  syncApps?: boolean;
}

/**
 * Next.js redirect error check utility
 */
export function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.includes("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.includes("NEXT_NOT_FOUND"))
  );
}
