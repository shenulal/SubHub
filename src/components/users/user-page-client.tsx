// src/components/users/user-page-client.tsx
"use client";

import {
  AdvancedFilterBar,
  type FilterDefinition,
} from "@/components/common/advanced-filter-bar";
import { ColumnsDropdown } from "@/components/common/columns-dropdown";
import { KpiCard, KpiCardsGrid } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { useQuickCreate } from "@/components/common/quick-create/quick-create-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserListColumns, UserList } from "@/components/users/user-list";
import { useSafePermissions } from "@/hooks/use-permission-flag";
import type { UserListItem } from "@/types/user";
import { useList } from "@refinedev/core";
import { UserCheck, UserMinus, UserPlus, Users, UserX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

type Role = "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null | undefined;

interface UserPageClientProps {
  role?: Role;
}

export function UserPageClient({ role }: UserPageClientProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<
    Record<string, Set<string>>
  >({
    status: new Set<string>(),
    role: new Set<string>(),
  });

  // Column visibility state (managed externally)
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});

  // Selected row state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const handleColumnVisibilityChange = useCallback(
    (columnId: string, visible: boolean) => {
      setColumnVisibility((prev) => ({
        ...prev,
        [columnId]: visible,
      }));
    },
    []
  );

  const {
    query: { data, isLoading },
  } = useList<UserListItem>({
    resource: "users",
    pagination: { pageSize: 50 },
    sorters: [{ field: "name", order: "asc" }],
  });

  const users = useMemo(() => data?.data ?? [], [data?.data]);
  const total = useMemo(
    () => data?.total ?? users.length,
    [users.length, data?.total]
  );

  // Compute user statistics
  const stats = useMemo(() => {
    const activeCount = users.filter((u) => u.status === "ACTIVE").length;
    const inactiveCount = users.filter((u) => u.status === "INACTIVE").length;
    const terminatedCount = users.filter(
      (u) => u.status === "TERMINATED"
    ).length;
    return { activeCount, inactiveCount, terminatedCount };
  }, [users]);

  // Filter definitions
  const filters: FilterDefinition[] = useMemo(
    () => [
      {
        id: "status",
        title: t("users.filter.status"),
        options: [
          { label: t("users.status.active"), value: "ACTIVE" },
          { label: t("users.status.inactive"), value: "INACTIVE" },
          { label: t("users.status.terminated"), value: "TERMINATED" },
        ],
      },
      {
        id: "role",
        title: t("users.filter.role"),
        options: [
          { label: t("users.role.admin"), value: "ADMIN" },
          { label: t("users.role.member"), value: "MEMBER" },
          { label: t("users.role.viewer"), value: "VIEWER" },
        ],
      },
    ],
    [t]
  );

  const handleFilterChange = (filterId: string, values: Set<string>) => {
    setSelectedFilters((prev) => ({ ...prev, [filterId]: values }));
  };

  const clearAllFilters = () => {
    setSelectedFilters({
      status: new Set<string>(),
      role: new Set<string>(),
    });
  };

  // Filtered user list
  const filteredUsers = useMemo(() => {
    let result = users;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.name || "").toLowerCase().includes(q) ||
          (u.department || "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (selectedFilters.status.size > 0) {
      result = result.filter((u) => selectedFilters.status.has(u.status));
    }

    // Role filter
    if (selectedFilters.role.size > 0) {
      result = result.filter((u) => selectedFilters.role.has(u.role));
    }

    return result;
  }, [users, searchQuery, selectedFilters]);

  // Inviting needs members:invite (re-checked by createInvitation)
  const { can } = useSafePermissions();
  const quickCreate = useQuickCreate();
  const canInvite = can("members:invite");

  // Loading state - skeleton UI
  if (isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="size-10 rounded-md" />
                <Skeleton className="mt-4 h-4 w-20" />
                <Skeleton className="mt-2 h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Bar Skeleton */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Table Skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Page header */}
      <PageHeader
        title={t("users.page.title")}
        actions={
          canInvite
            ? [
                {
                  label: t("users.page.inviteUser"),
                  icon: UserPlus,
                  ...(quickCreate
                    ? { onClick: () => quickCreate.open("invite") }
                    : { href: "/settings/team" }),
                },
              ]
            : undefined
        }
      />

      {/* Stat cards */}
      <KpiCardsGrid columns={4}>
        <KpiCard title={t("users.kpi.total")} value={total} icon={Users} />
        <KpiCard
          title={t("users.kpi.active")}
          value={stats.activeCount}
          icon={UserCheck}
          change={
            total > 0
              ? {
                  value: Math.round((stats.activeCount / total) * 100),
                  type: "neutral",
                }
              : undefined
          }
        />
        <KpiCard
          title={t("users.kpi.inactive")}
          value={stats.inactiveCount}
          icon={UserMinus}
        />
        <KpiCard
          title={t("users.kpi.terminated")}
          value={stats.terminatedCount}
          icon={UserX}
        />
      </KpiCardsGrid>

      {/* Filter toolbar */}
      <AdvancedFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t("users.table.searchPlaceholder")}
        filters={filters}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
        onClearAllFilters={clearAllFilters}
      >
        <ColumnsDropdown
          columns={getUserListColumns(t)}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={handleColumnVisibilityChange}
        />
      </AdvancedFilterBar>

      {/* User list */}
      <UserList
        users={filteredUsers}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={handleColumnVisibilityChange}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        hideToolbar
      />
    </div>
  );
}
