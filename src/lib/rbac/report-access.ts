// src/lib/rbac/report-access.ts
/**
 * Report / analytics scope: viewers holding `subscriptions:read_all` see the
 * whole organisation; everyone else is pinned to their own team (or to
 * themselves without a team) by `resolveReportScope` /
 * `resolveReportFilterParams`.
 */
import { can } from "./service";

export const REPORT_READ_ALL_PERMISSION = "subscriptions:read_all" as const;

/** Copy of the session user with `canReadAll` resolved from permissions. */
export async function withReportAccess<T extends object>(
  user: T
): Promise<T & { canReadAll: boolean }> {
  return { ...user, canReadAll: await can(REPORT_READ_ALL_PERMISSION) };
}
