// src/lib/filters/report-filter-params.ts
/**
 * Team / user selection shared by the cost, renewal and usage reports.
 * URL keys stay `teamId` / `userId`; each holds a comma-separated list
 * (a legacy single id still works). Restricted roles (non-admin) are pinned
 * to their own team, or to themselves when they have no team.
 */
import { parseMultiValue, serializeMultiValue } from "./multi-value";

export interface ReportFilterSelection {
  teamIds: string[];
  userIds: string[];
}

export interface ReportFilterViewer {
  id: string;
  role?: string | null;
  teamId?: string | null;
}

type RawParam = string | string[] | null | undefined;

export function isRestrictedReportViewer(viewer: ReportFilterViewer): boolean {
  return viewer.role !== "ADMIN";
}

export function resolveReportFilterParams(
  params: { teamId?: RawParam; userId?: RawParam },
  viewer: ReportFilterViewer
): ReportFilterSelection {
  const teamIds = parseMultiValue(params.teamId);
  const userIds = parseMultiValue(params.userId);
  if (!isRestrictedReportViewer(viewer)) return { teamIds, userIds };
  if (!viewer.teamId) return { teamIds: [], userIds: [viewer.id] };
  return { teamIds: [viewer.teamId], userIds };
}

/** Write a selection into URL params (empty list removes the key). */
export function writeReportFilterParams(
  params: URLSearchParams,
  selection: ReportFilterSelection
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const entries: Array<[string, string[]]> = [
    ["teamId", selection.teamIds],
    ["userId", selection.userIds],
  ];
  for (const [key, values] of entries) {
    const serialized = serializeMultiValue(values);
    if (serialized) next.set(key, serialized);
    else next.delete(key);
  }
  return next;
}
