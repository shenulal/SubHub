// src/lib/dashboard-layout.ts
// Utilities for computing dynamic dashboard widget layouts

export type WidgetSlot = {
  key: string;
  baseSpan: number;
};

/**
 * Layout definitions per dashboard section (12-column grid)
 */
export const DASHBOARD_LAYOUT = {
  topRow: [
    { key: "priorityCard", baseSpan: 6 },
    { key: "pendingConfirmations", baseSpan: 6 },
  ],
  chartsRow: [
    { key: "monthlyCostTrend", baseSpan: 8 },
    { key: "topAppsCostChart", baseSpan: 4 },
  ],
  costRow1: [
    { key: "costRow1Left", baseSpan: 8 },
    { key: "costRow1Right", baseSpan: 4 },
  ],
  costRow2: [
    { key: "savingsOpportunity", baseSpan: 4 },
    { key: "securityStatCards", baseSpan: 8 },
  ],
  discoveryRow: [
    { key: "appsByCategory", baseSpan: 4 },
    { key: "discoverySources", baseSpan: 8 },
  ],
  departmentRow: [
    { key: "departmentOverview", baseSpan: 8 },
    { key: "recentActivity", baseSpan: 4 },
  ],
} as const;

/**
 * Dynamically compute the col-span of visible widgets based on visibility state
 *
 * - all visible: keep the default ratio (e.g. 6:6, 8:4)
 * - some hidden: remaining widgets share the 12 columns proportionally
 * - only one visible: full width (12)
 * - all hidden: returns an empty Map
 */
export function getRowSpans(
  widgets: readonly WidgetSlot[],
  visibility: Record<string, boolean | undefined>
): Map<string, number> {
  const visible = widgets.filter((w) => visibility[w.key] !== false);

  if (visible.length === 0) return new Map();
  if (visible.length === 1) return new Map([[visible[0].key, 12]]);

  const totalBase = visible.reduce((sum, w) => sum + w.baseSpan, 0);
  const result = new Map<string, number>();

  for (const w of visible) {
    result.set(w.key, Math.round((w.baseSpan / totalBase) * 12));
  }

  // Correct rounding error: assign the remainder to the last widget
  const assigned = [...result.values()].reduce((a, b) => a + b, 0);
  if (assigned !== 12) {
    const lastKey = visible[visible.length - 1].key;
    result.set(lastKey, result.get(lastKey)! + (12 - assigned));
  }

  return result;
}

/**
 * Convert a col-span value into responsive Tailwind classes
 * Uses classes instead of inline styles so responsive breakpoints work correctly
 *
 * Supported breakpoints: 'lg' (1024px+), 'xl' (1280px+)
 * Supported spans: 4, 6, 8, 12
 */

// Map every possible class explicitly so Tailwind's static analysis picks them up
// lg:col-span-4 lg:col-span-6 lg:col-span-8 lg:col-span-12
// xl:col-span-4 xl:col-span-6 xl:col-span-8 xl:col-span-12
const LG_SPAN: Record<number, string> = {
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

const XL_SPAN: Record<number, string> = {
  4: "xl:col-span-4",
  6: "xl:col-span-6",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};

export function gridColClass(
  span: number,
  breakpoint: "lg" | "xl" = "lg"
): string {
  const map = breakpoint === "xl" ? XL_SPAN : LG_SPAN;
  return map[span] ?? "";
}
