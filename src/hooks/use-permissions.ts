// src/hooks/use-permissions.ts
"use client";

import type { PermissionKey } from "@/lib/rbac/permissions";
import { useQuery } from "@tanstack/react-query";

interface PermissionsResponse {
  success: boolean;
  data?: { permissions: string[]; role: string; organizationId: string | null };
}

async function fetchPermissions(): Promise<Set<string>> {
  const res = await fetch("/api/v1/me/permissions", { credentials: "include" });
  if (!res.ok) return new Set();
  const json = (await res.json()) as PermissionsResponse;
  return new Set(json.data?.permissions ?? []);
}

/**
 * Client-side permission lookup for gating buttons, menu items and routes.
 * The server remains the source of truth — every action re-checks with `requirePermission`.
 */
export function usePermissions() {
  const query = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: fetchPermissions,
    staleTime: 60_000,
  });
  const set = query.data ?? new Set<string>();
  const can = (
    permission: PermissionKey | PermissionKey[],
    mode: "all" | "any" = "all"
  ) => {
    const list = Array.isArray(permission) ? permission : [permission];
    return mode === "all"
      ? list.every((k) => set.has(k))
      : list.some((k) => set.has(k));
  };
  return {
    permissions: set,
    can,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
