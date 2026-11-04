// src/components/notifications/use-notifications.ts
"use client";

/**
 * React Query hooks over the notification REST endpoints. Shared by the bell
 * and the full centre so a mark-read in one place updates the other.
 */
import type {
  NotificationItem,
  NotificationListPage,
} from "@/types/notification";
import type { NotificationEventType } from "@prisma/client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const UNREAD_POLL_INTERVAL_MS = 60_000;
export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

interface ListResponse {
  success: boolean;
  data?: NotificationItem[];
  meta?: { nextCursor: string | null; unreadCount: number };
}

interface CountResponse {
  success: boolean;
  data?: { count: number };
}

export interface NotificationListFilters {
  unreadOnly?: boolean;
  types?: NotificationEventType[];
  limit?: number;
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function fetchNotificationPage(
  filters: NotificationListFilters,
  cursor: string | null
): Promise<NotificationListPage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.unreadOnly) params.set("unreadOnly", "true");
  if (filters.types?.length) params.set("types", filters.types.join(","));
  const json = await fetchJson<ListResponse>(`/api/v1/notifications?${params}`);
  return {
    items: json.data ?? [],
    nextCursor: json.meta?.nextCursor ?? null,
    unreadCount: json.meta?.unreadCount ?? 0,
  };
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "unread-count"],
    queryFn: async () => {
      const json = await fetchJson<CountResponse>(
        "/api/v1/notifications/unread-count"
      );
      return json.data?.count ?? 0;
    },
    refetchInterval: UNREAD_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    staleTime: UNREAD_POLL_INTERVAL_MS / 2,
    enabled,
  });
}

export function useNotificationList(filters: NotificationListFilters) {
  return useInfiniteQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, "list", filters],
    queryFn: ({ pageParam }) => fetchNotificationPage(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ids: string[] } | { all: true }) => {
      await fetchJson("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    },
  });
}
