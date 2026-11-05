// src/components/payments/use-rematch-selection.ts
"use client";

import { useCallback, useState } from "react";

/**
 * Hook managing row selection state for rematching
 */
export function useRematchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectedRowsChange = useCallback((newSelected: Set<string>) => {
    setSelectedIds(newSelected);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedIdsArray = Array.from(selectedIds);

  return {
    selectedIds,
    selectedIdsArray,
    handleSelectedRowsChange,
    clearSelection,
  };
}
