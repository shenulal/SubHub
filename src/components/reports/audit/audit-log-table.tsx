// src/components/reports/audit/audit-log-table.tsx
"use client";

import {
  DataTable,
  useDataTable,
  type DataTableColumn,
} from "@/components/common/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatKoreanDateTime } from "@/lib/date";
import type { AuditLogEntry } from "@/types/audit";
import { Eye, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

// Column definitions for the column-visibility dropdown (exported)
export function getAuditLogColumns(t: (key: string) => string) {
  return [
    { id: "createdAt", header: t("reports.audit.columns.createdAt") },
    { id: "user", header: t("reports.audit.columns.user") },
    { id: "action", header: t("reports.audit.columns.action") },
    { id: "entity", header: t("reports.audit.columns.entity") },
    { id: "ipAddress", header: t("reports.audit.columns.ipAddress") },
  ];
}

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  onViewDetail: (log: AuditLogEntry) => void;
  // Used when column visibility is controlled externally
  columnVisibility?: Record<string, boolean>;
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void;
  hideToolbar?: boolean;
}

function getActionCategory(action: string): string {
  if (action.startsWith("CREATE")) return "CREATE";
  if (action.startsWith("UPDATE")) return "UPDATE";
  if (action.startsWith("DELETE")) return "DELETE";
  if (action.startsWith("LOGIN")) return "LOGIN";
  if (action.startsWith("LOGOUT")) return "LOGOUT";
  if (action.startsWith("SYNC")) return "SYNC";
  if (action.startsWith("EXPORT")) return "EXPORT";
  if (action.startsWith("IMPORT")) return "IMPORT";
  return action;
}

type BadgeTone = "secondary" | "success" | "info" | "primary" | "error";

function getActionBadge(action: string, t: (key: string) => string) {
  const category = getActionCategory(action);

  const actionConfig: Record<string, { label: string; variant: BadgeTone }> = {
    CREATE: { label: t("reports.audit.actions.create"), variant: "success" },
    UPDATE: { label: t("reports.audit.actions.update"), variant: "info" },
    DELETE: {
      label: t("reports.audit.actions.delete"),
      variant: "error",
    },
    LOGIN: { label: t("reports.audit.actions.login"), variant: "secondary" },
    LOGOUT: { label: t("reports.audit.actions.logout"), variant: "secondary" },
    SYNC: { label: t("reports.audit.actions.sync"), variant: "primary" },
    EXPORT: { label: t("reports.audit.actions.export"), variant: "secondary" },
    IMPORT: { label: t("reports.audit.actions.import"), variant: "secondary" },
  };
  const config = actionConfig[category] || {
    label: action,
    variant: "secondary" as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getEntityTypeName(
  entityType: string,
  t: (key: string) => string
): string {
  const names: Record<string, string> = {
    App: t("reports.audit.entityTypes.app"),
    Subscription: t("reports.audit.entityTypes.subscription"),
    User: t("reports.audit.entityTypes.user"),
    Integration: t("reports.audit.entityTypes.integration"),
    Organization: t("reports.audit.entityTypes.organization"),
    Payment: t("reports.audit.entityTypes.payment"),
  };
  return names[entityType] || entityType;
}

function getEntityDisplayName(log: AuditLogEntry): string | null {
  const metadata = (log.metadata || {}) as Record<string, unknown>;

  switch (log.entityType) {
    case "App":
      return (metadata.appName as string) ?? null;
    case "Subscription": {
      const appName = metadata.appName as string | undefined;
      const amount = metadata.amount as number | undefined;
      if (appName && typeof amount === "number") {
        return `${appName} · ${amount.toLocaleString()}`;
      }
      return appName ?? null;
    }
    case "User":
      return log.userName || log.userEmail;
    default:
      return null;
  }
}

export function AuditLogTable({
  logs,
  onViewDetail,
  columnVisibility: externalColumnVisibility,
  onColumnVisibilityChange: externalOnColumnVisibilityChange,
  hideToolbar = false,
}: AuditLogTableProps) {
  const t = useTranslations();
  const {
    columnVisibility: internalColumnVisibility,
    handleColumnVisibilityChange: internalHandleColumnVisibilityChange,
    sortState,
    setSortState,
    pagination,
    setPagination,
  } = useDataTable({ defaultPageSize: 10 });

  // Use external state when provided, otherwise internal state
  const columnVisibility = externalColumnVisibility ?? internalColumnVisibility;
  const handleColumnVisibilityChange =
    externalOnColumnVisibilityChange ?? internalHandleColumnVisibilityChange;

  // Column definitions
  const columns: DataTableColumn<AuditLogEntry>[] = useMemo(
    () => [
      {
        id: "createdAt",
        header: t("reports.audit.columns.createdAt"),
        sortable: true,
        cell: (log) => (
          <span className="whitespace-nowrap">
            {formatKoreanDateTime(log.createdAt)}
          </span>
        ),
      },
      {
        id: "user",
        header: t("reports.audit.columns.user"),
        cell: (log) => (
          <div className="min-w-0">
            <p className="max-w-[16rem] truncate font-medium">
              {log.userName || "-"}
            </p>
            <p className="text-muted-foreground max-w-[16rem] truncate text-xs">
              {log.userEmail}
            </p>
          </div>
        ),
      },
      {
        id: "action",
        header: t("reports.audit.columns.action"),
        cell: (log) => getActionBadge(log.action, t),
      },
      {
        id: "entity",
        header: t("reports.audit.columns.entity"),
        cell: (log) => {
          const displayName = getEntityDisplayName(log);
          const fallbackId = log.entityId
            ? `${log.entityId.slice(0, 8)}...`
            : null;

          return (
            <div className="min-w-0">
              <p className="font-medium">
                {getEntityTypeName(log.entityType, t)}
              </p>
              {(displayName || fallbackId) && (
                <p className="text-muted-foreground max-w-[18rem] truncate text-xs">
                  {displayName || fallbackId}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "ipAddress",
        header: t("reports.audit.columns.ipAddress"),
        cell: (log) => (
          <span className="text-muted-foreground text-sm">
            {log.ipAddress || "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        headerClassName: "w-[80px]",
        cell: (log) => (
          <Button variant="ghost" size="icon" onClick={() => onViewDetail(log)}>
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [onViewDetail, t]
  );

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortState) return logs;

    return [...logs].sort((a, b) => {
      const { columnId, direction } = sortState;
      let aVal: string | number | Date = "";
      let bVal: string | number | Date = "";

      switch (columnId) {
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [logs, sortState]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return sortedData.slice(start, start + pagination.pageSize);
  }, [sortedData, pagination]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="tonal-neutral mb-3 flex size-10 items-center justify-center rounded-md">
          <FileText className="size-5" />
        </div>
        <h3 className="text-lg font-medium">
          {t("reports.audit.empty.title")}
        </h3>
        <p className="text-muted-foreground mt-2">
          {t("reports.audit.empty.description")}
        </p>
      </div>
    );
  }

  return (
    <DataTable
      data={paginatedData}
      columns={columns}
      getRowId={(row) => row.id}
      // Column visibility
      enableColumnVisibility
      columnVisibility={columnVisibility}
      onColumnVisibilityChange={handleColumnVisibilityChange}
      // Sorting
      enableSorting
      sortState={sortState}
      onSortChange={setSortState}
      // Pagination
      enablePagination
      pagination={pagination}
      onPaginationChange={setPagination}
      totalCount={logs.length}
      // Other
      emptyMessage={t("reports.audit.empty.title")}
      hideToolbar={hideToolbar}
    />
  );
}
