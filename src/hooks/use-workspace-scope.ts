// src/hooks/use-workspace-scope.ts
"use client";

/**
 * Client-side Workspace | Personal scope (6.4). The store hydrates from the
 * `subhub_scope` cookie immediately and from the server action afterwards (which
 * also tells us whether personal mode is allowed). Switching persists via the
 * server action and refreshes server components so lists/dashboard re-read it.
 */
import {
  getWorkspaceScope,
  setWorkspaceScope,
} from "@/actions/discovery/scope";
import {
  DEFAULT_SCOPE,
  readScopeCookie,
} from "@/lib/services/discovery/scope-cookie";
import type { WorkspaceScope } from "@/types/discovery";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { create } from "zustand";

interface ScopeStore {
  scope: WorkspaceScope;
  allowPersonal: boolean;
  hydrated: boolean;
  isPending: boolean;
  setLocal: (scope: WorkspaceScope) => void;
  hydrate: (state: { scope: WorkspaceScope; allowPersonal: boolean }) => void;
  setPending: (pending: boolean) => void;
}

function initialScope(): WorkspaceScope {
  if (typeof document === "undefined") return DEFAULT_SCOPE;
  try {
    return readScopeCookie(document.cookie) ?? DEFAULT_SCOPE;
  } catch {
    return DEFAULT_SCOPE;
  }
}

export const useWorkspaceScopeStore = create<ScopeStore>((set) => ({
  scope: initialScope(),
  allowPersonal: false,
  hydrated: false,
  isPending: false,
  setLocal: (scope) => set({ scope }),
  hydrate: ({ scope, allowPersonal }) =>
    set({ scope, allowPersonal, hydrated: true }),
  setPending: (isPending) => set({ isPending }),
}));

export interface UseWorkspaceScope {
  scope: WorkspaceScope;
  allowPersonal: boolean;
  isPersonal: boolean;
  hydrated: boolean;
  isPending: boolean;
  setScope: (scope: WorkspaceScope) => Promise<void>;
}

export function useWorkspaceScope(): UseWorkspaceScope {
  const router = useRouter();
  const store = useWorkspaceScopeStore();

  useEffect(() => {
    if (store.hydrated) return;
    let cancelled = false;
    getWorkspaceScope()
      .then((state) => {
        if (!cancelled) store.hydrate(state);
      })
      .catch(() => {
        if (!cancelled) {
          store.hydrate({ scope: store.scope, allowPersonal: false });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.hydrated]);

  const setScope = useCallback(
    async (next: WorkspaceScope) => {
      const previous = store.scope;
      store.setLocal(next);
      store.setPending(true);
      try {
        const result = await setWorkspaceScope(next);
        if (result.success && result.data) {
          store.hydrate(result.data);
          router.refresh();
        } else {
          store.setLocal(previous);
        }
      } catch {
        store.setLocal(previous);
      } finally {
        store.setPending(false);
      }
    },
    [router, store]
  );

  return {
    scope: store.scope,
    allowPersonal: store.allowPersonal,
    isPersonal: store.scope === "personal",
    hydrated: store.hydrated,
    isPending: store.isPending,
    setScope,
  };
}
