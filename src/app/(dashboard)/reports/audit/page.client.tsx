// src/app/(dashboard)/reports/audit/page.client.tsx
"use client";

import {
  AdvancedFilterBar,
  type FilterDefinition,
} from "@/components/common/advanced-filter-bar";
import { DateRangeSelector } from "@/components/common/date-range-selector";
import {
  AuditLogDetailDialog,
  AuditLogTable,
} from "@/components/reports/audit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeAuditAction } from "@/lib/audit/describe-action";
import {
  mergeLegacyValue,
  serializeMultiValue,
} from "@/lib/filters/multi-value";
import type {
  AuditLogEntry,
  AuditLogFilterOptions,
  AuditLogFilters,
} from "@/types/audit";
import { Download, File, FileSpreadsheet, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

const AUDIT_FACETS = ["action", "entityType", "userId", "teamId"] as const;
type AuditFacet = (typeof AUDIT_FACETS)[number];

/** Initial selection from the server filters (list + legacy single value). */
function toSet(list?: string[], single?: string): Set<string> {
  return new Set(mergeLegacyValue(list, single) ?? []);
}

interface AuditLogPageClientProps {
  initialLogs: AuditLogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filterOptions: AuditLogFilterOptions;
  initialFilters: AuditLogFilters;
  canExport: boolean;
  presets: Array<{ value: string; label: string }>;
  currentPeriod: string;
  currentStartDate: string;
  currentEndDate: string;
}

export function AuditLogPageClient({
  initialLogs,
  filterOptions,
  initialFilters,
  canExport,
  presets,
  currentPeriod,
  currentStartDate,
  currentEndDate,
}: AuditLogPageClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const entityTypeLabels: Record<string, string> = {
    App: t("reports.audit.entityTypes.app"),
    Subscription: t("reports.audit.entityTypes.subscription"),
    User: t("reports.audit.entityTypes.user"),
    Integration: t("reports.audit.entityTypes.integration"),
    Organization: t("reports.audit.entityTypes.organization"),
    Payment: t("reports.audit.entityTypes.payment"),
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialFilters.search || "");

  // Filter state (Set-based; every facet is multi-select, empty = all)
  const [selectedFilters, setSelectedFilters] = useState<
    Record<AuditFacet, Set<string>>
  >({
    action: toSet(initialFilters.actions, initialFilters.action),
    entityType: toSet(initialFilters.entityTypes, initialFilters.entityType),
    userId: toSet(initialFilters.userIds, initialFilters.userId),
    teamId: toSet(initialFilters.teamIds, initialFilters.teamId),
  });

  // Update the URL query (lists are comma-separated)
  const updateUrlParams = useCallback(
    (filters: {
      search?: string;
      facets: Record<AuditFacet, Set<string>>;
      startDate?: string;
      endDate?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams();

      if (filters.search) params.set("search", filters.search);
      for (const facet of AUDIT_FACETS) {
        const value = serializeMultiValue([...filters.facets[facet]]);
        if (value) params.set(facet, value);
      }
      if (filters.startDate)
        params.set("startDate", `${filters.startDate}T00:00:00Z`);
      if (filters.endDate)
        params.set("endDate", `${filters.endDate}T23:59:59Z`);
      if (filters.page && filters.page > 1)
        params.set("page", filters.page.toString());

      const queryString = params.toString();
      router.push(
        queryString ? `/reports/audit?${queryString}` : "/reports/audit"
      );
    },
    [router]
  );

  // Filter change handler (for AdvancedFilterBar)
  const handleFilterChange = useCallback(
    (filterId: string, values: Set<string>) => {
      const facets = {
        ...selectedFilters,
        [filterId as AuditFacet]: values,
      };
      setSelectedFilters(facets);
      updateUrlParams({
        search: searchQuery || undefined,
        facets,
        startDate: currentStartDate,
        endDate: currentEndDate,
      });
    },
    [
      selectedFilters,
      searchQuery,
      updateUrlParams,
      currentStartDate,
      currentEndDate,
    ]
  );

  // Search change handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Reset all filters
  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedFilters({
      action: new Set(),
      entityType: new Set(),
      userId: new Set(),
      teamId: new Set(),
    });
    router.push("/reports/audit");
  }, [router]);

  // View details handler
  const handleViewDetail = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  // CSV export handler
  const handleExportCSV = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    window.open(`/api/reports/audit/export?${params.toString()}`, "_blank");
  };

  // Filter definitions
  const filters: FilterDefinition[] = useMemo(
    () => [
      {
        id: "action",
        title: t("reports.audit.columns.action"),
        options: filterOptions.actions.map((action) => ({
          label: describeAuditAction(action),
          value: action,
        })),
      },
      {
        id: "entityType",
        title: t("reports.audit.columns.entity"),
        options: filterOptions.entityTypes.map((type) => ({
          label: entityTypeLabels[type] || type,
          value: type,
        })),
      },
      {
        id: "userId",
        title: t("reports.audit.columns.user"),
        options: filterOptions.users.map((user) => ({
          label: user.name || user.email,
          value: user.id,
        })),
      },
      // Team facet (applied server-side for admins only)
      ...(filterOptions.teams.length > 0
        ? [
            {
              id: "teamId",
              title: t("reports.audit.export.columns.teamName"),
              options: filterOptions.teams.map((team) => ({
                label: team.name,
                value: team.id,
              })),
            },
          ]
        : []),
    ],
    [filterOptions, entityTypeLabels, t]
  );

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <AdvancedFilterBar
        searchValue={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder={t("reports.audit.columns.searchPlaceholder")}
        filters={filters}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        onClearAllFilters={clearAllFilters}
      >
        {/* Period selector */}
        <DateRangeSelector
          currentPeriod={currentPeriod}
          startDate={currentStartDate}
          endDate={currentEndDate}
          presets={presets}
          basePath="/reports/audit"
          preserveParams={{
            ...(searchQuery ? { search: searchQuery } : {}),
            ...Object.fromEntries(
              AUDIT_FACETS.map((facet) => [
                facet,
                serializeMultiValue([...selectedFilters[facet]]) ?? "",
              ])
            ),
          }}
        />

        {/* Export */}
        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0">
                <Download className="mr-2 h-4 w-4" />
                {t("reports.audit.export.button")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="mr-2 h-4 w-4" />
                {t("reports.audit.export.csvLabel")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t("reports.audit.export.excelLabel")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <File className="mr-2 h-4 w-4" />
                {t("reports.audit.export.pdfLabel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </AdvancedFilterBar>

      {/* Table */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <AuditLogTable
            logs={initialLogs}
            onViewDetail={handleViewDetail}
            hideToolbar
          />
        </CardContent>
      </Card>

      {/* Details dialog */}
      <AuditLogDetailDialog
        log={selectedLog}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}
