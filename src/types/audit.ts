// src/types/audit.ts

/**
 * Audit log types
 */

export interface AuditLogFilters {
  /** Legacy single values; merged with the lists below. */
  action?: string;
  userId?: string;
  teamId?: string;
  entityType?: string;
  /** Multi-select filters (empty / missing = all). */
  actions?: string[];
  userIds?: string[];
  teamIds?: string[];
  entityTypes?: string[];
  startDate?: string; // ISO 8601 string
  endDate?: string; // ISO 8601 string
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string; // ISO 8601 string
}

export interface AuditLogListResponse {
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuditLogFilterOptions {
  actions: string[];
  entityTypes: string[];
  users: Array<{
    id: string;
    name: string;
    email: string;
    teamId: string | null;
    teamName: string | null;
  }>;
  teams: Array<{ id: string; name: string }>;
}

export interface AuditLogExportEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  userName: string | null;
  userEmail: string | null;
  teamName: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
