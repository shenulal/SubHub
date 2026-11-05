// src/components/common/quick-create/quick-create-context.ts
"use client";

/** Context for opening quick-create dialogs (kept free of dialog imports). */
import { createContext, useContext } from "react";

import type { QuickCreateKind } from "./quick-create-registry";

export interface QuickCreateContextValue {
  open: (kind: QuickCreateKind) => void;
}

export const QuickCreateContext = createContext<QuickCreateContextValue | null>(
  null
);

/** Returns null outside the provider (callers then fall back to links). */
export function useQuickCreate(): QuickCreateContextValue | null {
  return useContext(QuickCreateContext);
}
