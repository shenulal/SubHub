// src/lib/services/platform-analytics/queries.ts
/**
 * Aggregate SQL for Control Panel analytics. Each function is ONE query that
 * returns grouped rows (never one query per organisation). Soft-deleted
 * organisations (`deleted_at`) are always excluded. Pass `organizationId` to
 * scope a query to one organisation; omit it for the platform-wide figures.
 * Money is returned in its stored currency/billing cycle — conversion to a base
 * currency happens in `./money` through the FX module.
 */
import { AUTH_AUDIT_ACTIONS } from "@/lib/auth/auth-audit";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface ScopeArgs {
  organizationId?: string;
}

const orgFilter = (alias: string, organizationId?: string) =>
  organizationId
    ? Prisma.sql`AND ${Prisma.raw(alias)}.id = ${organizationId}`
    : Prisma.empty;

export interface OrganizationActivityRow {
  id: string;
  name: string;
  createdAt: Date;
  deactivatedAt: Date | null;
  users: number;
  activeUsers: number;
  signedInUsers: number;
  lastLoginAt: Date | null;
  activeSubscriptions: number;
  renewalsDue: number;
  pendingApprovals: number;
}

/** Per-organisation counts (users, sign-ins, subscriptions, renewals, approvals). */
export function queryOrganizationActivity(
  args: ScopeArgs & { since: Date; now: Date; renewalUntil: Date }
): Promise<OrganizationActivityRow[]> {
  const { since, now, renewalUntil, organizationId } = args;
  return prisma.$queryRaw<OrganizationActivityRow[]>`
    SELECT o.id, o.name,
           o.created_at                    AS "createdAt",
           o.deactivated_at                AS "deactivatedAt",
           COALESCE(u.total, 0)::int       AS "users",
           COALESCE(u.active, 0)::int      AS "activeUsers",
           COALESCE(u.signed_in, 0)::int   AS "signedInUsers",
           u.last_login                    AS "lastLoginAt",
           COALESCE(s.active, 0)::int      AS "activeSubscriptions",
           COALESCE(s.renewals, 0)::int    AS "renewalsDue",
           COALESCE(a.pending, 0)::int     AS "pendingApprovals"
      FROM organizations o
      LEFT JOIN (
        SELECT organization_id,
               count(*) AS total,
               count(*) FILTER (WHERE status = 'ACTIVE') AS active,
               count(*) FILTER (WHERE last_login_at >= ${since}) AS signed_in,
               max(last_login_at) AS last_login
          FROM users
         WHERE organization_id IS NOT NULL
         GROUP BY organization_id
      ) u ON u.organization_id = o.id
      LEFT JOIN (
        SELECT organization_id,
               count(*) FILTER (WHERE status = 'ACTIVE') AS active,
               count(*) FILTER (
                 WHERE status = 'ACTIVE'
                   AND renewal_date >= ${now}
                   AND renewal_date <= ${renewalUntil}
               ) AS renewals
          FROM subscriptions
         GROUP BY organization_id
      ) s ON s.organization_id = o.id
      LEFT JOIN (
        SELECT organization_id, count(*) AS pending
          FROM approval_requests
         WHERE status = 'PENDING'
         GROUP BY organization_id
      ) a ON a.organization_id = o.id
     WHERE o.deleted_at IS NULL ${orgFilter("o", organizationId)}
     ORDER BY o.name`;
}

export interface SpendRow {
  organizationId: string;
  currency: string;
  billingCycle: string;
  categoryKey: string | null;
  categoryLabel: string | null;
  teamKey: string | null;
  teamLabel: string | null;
  costCentreKey: string | null;
  costCentreLabel: string | null;
  appKey: string;
  appName: string;
  logoUrl: string | null;
  count: number;
  amount: number;
}

/**
 * ACTIVE subscriptions grouped by organisation, currency, cycle and the
 * dimensions the charts slice by (top-level category, team, cost centre, app).
 * Apps are matched across organisations by catalog entry, else by name.
 */
export function querySpendRows(args: ScopeArgs): Promise<SpendRow[]> {
  return prisma.$queryRaw<SpendRow[]>`
    SELECT s.organization_id                         AS "organizationId",
           s.currency,
           s.billing_cycle::text                     AS "billingCycle",
           COALESCE(pc.id, c.id)                     AS "categoryKey",
           COALESCE(pc.name, c.name)                 AS "categoryLabel",
           t.id                                      AS "teamKey",
           t.name                                    AS "teamLabel",
           cc.id                                     AS "costCentreKey",
           CASE WHEN cc.id IS NULL THEN NULL
                ELSE cc.code || ' · ' || cc.name END AS "costCentreLabel",
           COALESCE(a.catalog_id, lower(a.name))     AS "appKey",
           min(a.name)                               AS "appName",
           min(COALESCE(a.custom_logo_url, sc.logo_url)) AS "logoUrl",
           count(*)::int                             AS "count",
           sum(s.amount)::float8                     AS "amount"
      FROM subscriptions s
      JOIN organizations o ON o.id = s.organization_id AND o.deleted_at IS NULL
      JOIN apps a ON a.id = s.app_id
      LEFT JOIN saas_catalog sc ON sc.id = a.catalog_id
      LEFT JOIN categories c ON c.id = s.category_id
      LEFT JOIN categories pc ON pc.id = c.parent_id
      LEFT JOIN teams t ON t.id = s.team_id
      LEFT JOIN cost_centers cc ON cc.id = s.cost_center_id
     WHERE s.status = 'ACTIVE' ${orgFilter("o", args.organizationId)}
     GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10`;
}

export interface TrendRow {
  month: string;
  organizationId: string;
  currency: string;
  billingCycle: string;
  amount: number;
}

/**
 * Monthly run-rate per calendar month: subscriptions that had started by the
 * end of the month and were ACTIVE (or ended — cancelled/expired — on or after
 * the month start). The current month equals the live monthly-spend KPI.
 */
export function querySpendTrend(
  args: ScopeArgs & { since: Date; now: Date }
): Promise<TrendRow[]> {
  return prisma.$queryRaw<TrendRow[]>`
    SELECT to_char(m.month, 'YYYY-MM')  AS "month",
           s.organization_id            AS "organizationId",
           s.currency,
           s.billing_cycle::text        AS "billingCycle",
           sum(s.amount)::float8        AS "amount"
      FROM generate_series(
             date_trunc('month', ${args.since}::timestamp),
             date_trunc('month', ${args.now}::timestamp),
             interval '1 month'
           ) AS m(month)
      JOIN subscriptions s
        ON s.start_date < m.month + interval '1 month'
       AND (
             s.status = 'ACTIVE'
             OR (s.status IN ('CANCELLED', 'EXPIRED') AND s.end_date >= m.month)
           )
      JOIN organizations o ON o.id = s.organization_id AND o.deleted_at IS NULL
     WHERE TRUE ${orgFilter("o", args.organizationId)}
     GROUP BY 1, 2, 3, 4`;
}

export interface GrowthRow {
  series: "organizations" | "users" | "subscriptions";
  month: string;
  count: number;
}

/** New organisations, users and subscriptions per month since `since`. */
export function queryGrowth(
  args: ScopeArgs & { since: Date }
): Promise<GrowthRow[]> {
  const { since, organizationId } = args;
  const scoped = orgFilter("o", organizationId);
  return prisma.$queryRaw<GrowthRow[]>`
    SELECT 'organizations' AS "series",
           to_char(date_trunc('month', o.created_at), 'YYYY-MM') AS "month",
           count(*)::int AS "count"
      FROM organizations o
     WHERE o.deleted_at IS NULL AND o.created_at >= ${since} ${scoped}
     GROUP BY 2
    UNION ALL
    SELECT 'users', to_char(date_trunc('month', u.created_at), 'YYYY-MM'),
           count(*)::int
      FROM users u
      JOIN organizations o ON o.id = u.organization_id AND o.deleted_at IS NULL
     WHERE u.created_at >= ${since} ${scoped}
     GROUP BY 2
    UNION ALL
    SELECT 'subscriptions', to_char(date_trunc('month', s.created_at), 'YYYY-MM'),
           count(*)::int
      FROM subscriptions s
      JOIN organizations o ON o.id = s.organization_id AND o.deleted_at IS NULL
     WHERE s.created_at >= ${since} ${scoped}
     GROUP BY 2`;
}

export interface CycleMonthsRow {
  organizationId: string;
  cycle: string;
  months: number;
}

/** Billing-cycle lengths (`BillingCycleConfig`) for every organisation in scope. */
export function queryCycleMonths(args: ScopeArgs): Promise<CycleMonthsRow[]> {
  return prisma.billingCycleConfig.findMany({
    where: {
      organization: { deletedAt: null },
      ...(args.organizationId && { organizationId: args.organizationId }),
    },
    select: { organizationId: true, cycle: true, months: true },
  });
}

export interface OrganizationDetailRow {
  apps: number;
  teams: number;
  pending: number;
  submitted: number;
  approved: number;
  rejected: number;
  avgDecisionSeconds: number | null;
}

/** Apps, teams and the approvals summary of one organisation (one query). */
export async function queryOrganizationDetail(
  organizationId: string,
  since: Date
): Promise<OrganizationDetailRow> {
  const rows = await prisma.$queryRaw<OrganizationDetailRow[]>`
    SELECT
      (SELECT count(*)::int FROM apps
        WHERE organization_id = ${organizationId} AND status = 'ACTIVE') AS "apps",
      (SELECT count(*)::int FROM teams
        WHERE organization_id = ${organizationId})                       AS "teams",
      count(*) FILTER (WHERE r.status = 'PENDING')::int                  AS "pending",
      count(*) FILTER (WHERE r.submitted_at >= ${since})::int           AS "submitted",
      count(*) FILTER (WHERE r.status = 'APPROVED' AND r.decided_at >= ${since})::int AS "approved",
      count(*) FILTER (WHERE r.status = 'REJECTED' AND r.decided_at >= ${since})::int AS "rejected",
      (avg(extract(epoch FROM r.decided_at - r.submitted_at)) FILTER (
         WHERE r.status IN ('APPROVED', 'REJECTED') AND r.decided_at >= ${since}
       ))::float8                                                        AS "avgDecisionSeconds"
      FROM approval_requests r
     WHERE r.organization_id = ${organizationId}`;
  return rows[0];
}

export interface CountRow {
  key: string;
  label: string | null;
  count: number;
}

/** Subscriptions of one organisation by status. */
export function querySubscriptionsByStatus(
  organizationId: string
): Promise<CountRow[]> {
  return prisma.$queryRaw<CountRow[]>`
    SELECT status::text AS "key", NULL AS "label", count(*)::int AS "count"
      FROM subscriptions
     WHERE organization_id = ${organizationId}
     GROUP BY 1
     ORDER BY 3 DESC`;
}

/** Users of one organisation by role (custom role name when assigned). */
export function queryUsersByRole(organizationId: string): Promise<CountRow[]> {
  return prisma.$queryRaw<CountRow[]>`
    SELECT COALESCE(r.id, u.role::text) AS "key",
           r.name                       AS "label",
           count(*)::int                AS "count"
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.organization_id = ${organizationId}
     GROUP BY 1, 2
     ORDER BY 3 DESC`;
}

export interface SignInRow {
  month: string;
  signIns: number;
  users: number;
}

/** Successful sign-ins per month (organisation audit log). */
export function querySignIns(
  organizationId: string,
  since: Date
): Promise<SignInRow[]> {
  return prisma.$queryRaw<SignInRow[]>`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS "month",
           count(*)::int                    AS "signIns",
           count(DISTINCT user_id)::int     AS "users"
      FROM audit_logs
     WHERE organization_id = ${organizationId}
       AND action = ${AUTH_AUDIT_ACTIONS.signInSuccess}
       AND created_at >= ${since}
     GROUP BY 1`;
}
