// src/hooks/use-permission-flag.ts
"use client";

/**
 * Single permission check that is safe outside a QueryClientProvider (returns
 * false there). Shares the `["me", "permissions"]` cache with `usePermissions`,
 * so it costs no extra request inside the app shell. Used to gate inline
 * "+ Create …" rows in pickers that are also rendered in isolation.
 */
import type { PermissionKey } from "@/lib/rbac/permissions";
import {
  QueryClient,
  QueryClientContext,
  useQuery,
} from "@tanstack/react-query";
import { useContext } from "react";

const PERMISSIONS_STALE_MS = 60_000;
const DETACHED_CLIENT = new QueryClient();

async function fetchPermissionSet(): Promise<Set<string>> {
  const res = await fetch("/api/v1/me/permissions", { credentials: "include" });
  if (!res.ok) return new Set();
  const json = (await res.json()) as { data?: { permissions?: string[] } };
  return new Set(json.data?.permissions ?? []);
}

export function usePermissionFlag(permission: PermissionKey): boolean {
  const client = useContext(QueryClientContext);
  const query = useQuery(
    {
      queryKey: ["me", "permissions"],
      queryFn: fetchPermissionSet,
      staleTime: PERMISSIONS_STALE_MS,
      enabled: Boolean(client),
    },
    client ?? DETACHED_CLIENT
  );
  return query.data?.has(permission) ?? false;
}
