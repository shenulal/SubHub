// src/components/apps/use-app-form-options.ts
"use client";

/**
 * Owners, teams and the icon size limit for the app create forms. A tiny
 * fetch-once cache (no React Query) so the dialog works in any provider tree.
 */
import {
  getAppFormOptions,
  type AppFormOptions,
} from "@/actions/apps-form-options";
import { useEffect, useState } from "react";

const CACHE_MS = 60_000;
let cached: { at: number; promise: Promise<AppFormOptions | null> } | null =
  null;

function load(): Promise<AppFormOptions | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = getAppFormOptions()
    .then((res) => (res.success && res.data ? res.data : null))
    .catch(() => null)
    .then((options) => {
      // Do not keep a failure: the next form that opens tries again.
      if (!options) cached = null;
      return options;
    });
  cached = { at: Date.now(), promise };
  return promise;
}

/** Test hook: forget the cached options. */
export function resetAppFormOptionsCache(): void {
  cached = null;
}

export function useAppFormOptions(enabled = true): {
  data: AppFormOptions | undefined;
} {
  const [data, setData] = useState<AppFormOptions | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void load().then((options) => {
      if (active && options) setData(options);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return { data };
}
