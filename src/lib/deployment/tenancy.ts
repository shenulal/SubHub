// src/lib/deployment/tenancy.ts
/**
 * Organisation provisioning rules per deployment mode (server-only).
 *
 * single-tenant  one organisation per installation. The first user to finish
 *                onboarding creates it (first-run setup) and becomes ADMIN; after
 *                that, creating another organisation is refused everywhere. New
 *                users join by invitation, or — when `system.allowSelfSignup` is on
 *                — automatically when their email domain is one of the
 *                organisation's domains.
 * saas           many organisations. With `system.allowSelfSignup` a new customer
 *                creates their own organisation; invitations join existing ones;
 *                domain auto-join only into the organisation that claimed the
 *                domain as its primary (unique) domain.
 */
import { prisma } from "@/lib/db";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import type { Prisma } from "@prisma/client";
import { isSaas, isSingleTenant } from "./mode";

type Db = Prisma.TransactionClient | typeof prisma;

/** Serialises organisation creation (pg advisory lock, released at commit). */
const ORGANIZATION_CREATE_LOCK = 4_2026_1106;

export const SINGLE_TENANT_LIMIT_MESSAGE =
  "This installation already has an organisation. Ask its administrator for an invitation.";
export const SELF_SIGNUP_DISABLED_MESSAGE =
  "Creating new organisations is disabled. Ask an administrator for an invitation.";

/** Business-rule violation that is safe to show to the user. */
export class TenancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenancyError";
  }
}

export interface TenantSummary {
  id: string;
  name: string;
}

export async function countOrganizations(db: Db = prisma): Promise<number> {
  return db.organization.count();
}

/**
 * Single-tenant only: "the" organisation of this installation. Always null in
 * SaaS mode — callers must resolve the organisation explicitly there.
 */
export async function getSingleTenantOrganization(
  db: Db = prisma
): Promise<TenantSummary | null> {
  if (!isSingleTenant()) return null;
  return db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/** Whether a new organisation may be created right now (first-run or SaaS). */
export async function canCreateOrganization(
  options: { viaSelfSignup: boolean },
  db: Db = prisma
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSingleTenant()) {
    return (await countOrganizations(db)) === 0
      ? { allowed: true }
      : { allowed: false, reason: SINGLE_TENANT_LIMIT_MESSAGE };
  }
  if (
    options.viaSelfSignup &&
    !(await getSystemSetting("system.allowSelfSignup"))
  ) {
    return { allowed: false, reason: SELF_SIGNUP_DISABLED_MESSAGE };
  }
  return { allowed: true };
}

/**
 * Call inside the creating transaction: takes the creation lock and re-checks the
 * single-tenant limit so two concurrent first-run sign-ups cannot both succeed.
 */
export async function assertOrganizationCreationAllowed(
  tx: Db,
  options: { viaSelfSignup: boolean }
): Promise<void> {
  if (isSingleTenant()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORGANIZATION_CREATE_LOCK})`;
  }
  const verdict = await canCreateOrganization(options, tx);
  if (!verdict.allowed) throw new TenancyError(verdict.reason ?? "");
}

export function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  return domain.length > 0 ? domain : null;
}

function organizationDomains(org: {
  domain: string | null;
  settings: Prisma.JsonValue;
}): string[] {
  const extra = (org.settings as { domains?: unknown } | null)?.domains;
  const list = Array.isArray(extra)
    ? extra.filter((d): d is string => typeof d === "string")
    : [];
  return [org.domain, ...list]
    .filter((d): d is string => Boolean(d))
    .map((d) => d.toLowerCase());
}

/**
 * Organisation a new user may join automatically because of their email domain,
 * or null. Requires `system.allowSelfSignup`.
 */
export async function findDomainJoinOrganization(
  email: string | null | undefined,
  db: Db = prisma
): Promise<TenantSummary | null> {
  const domain = emailDomain(email);
  if (!domain) return null;
  if (!(await getSystemSetting("system.allowSelfSignup"))) return null;

  if (isSaas()) {
    return db.organization.findFirst({
      where: {
        domain: { equals: domain, mode: "insensitive" },
        deactivatedAt: null,
      },
      select: { id: true, name: true },
    });
  }
  const org = await db.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      domain: true,
      settings: true,
      deactivatedAt: true,
    },
  });
  if (!org || org.deactivatedAt) return null;
  return organizationDomains(org).includes(domain)
    ? { id: org.id, name: org.name }
    : null;
}

export type OnboardingState =
  | { kind: "member" }
  | { kind: "deactivated"; organizationName: string }
  | { kind: "join"; organization: TenantSummary }
  | { kind: "create"; firstRun: boolean }
  | { kind: "invite-only"; reason: "installation-ready" | "signup-closed" };

/** What the onboarding page offers to a signed-in user. */
export async function getOnboardingState(
  userId: string,
  db: Db = prisma
): Promise<OnboardingState> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      organization: { select: { name: true, deactivatedAt: true } },
    },
  });
  if (user?.organization) {
    return user.organization.deactivatedAt
      ? { kind: "deactivated", organizationName: user.organization.name }
      : { kind: "member" };
  }
  const match = await findDomainJoinOrganization(user?.email, db);
  if (match) return { kind: "join", organization: match };

  const verdict = await canCreateOrganization({ viaSelfSignup: true }, db);
  if (verdict.allowed) {
    return { kind: "create", firstRun: isSingleTenant() };
  }
  return {
    kind: "invite-only",
    reason: isSingleTenant() ? "installation-ready" : "signup-closed",
  };
}

/**
 * Whether the public sign-up form is open: `system.allowSelfSignup`, or the
 * first-run setup of a single-tenant installation (no organisation yet).
 */
export async function isSignupOpen(db: Db = prisma): Promise<boolean> {
  if (await getSystemSetting("system.allowSelfSignup")) return true;
  return isSingleTenant() && (await countOrganizations(db)) === 0;
}

const SYSTEM_JOIN_ROLES = new Set(["APPROVER", "MEMBER", "VIEWER"]);

/**
 * Role for a user joining by email domain: the organisation's
 * `security.defaultRoleKey` (a system role key or a custom role key). ADMIN is
 * never granted automatically — it falls back to MEMBER.
 */
export async function resolveDomainJoinRole(
  organizationId: string,
  db: Db = prisma
): Promise<{ role: "APPROVER" | "MEMBER" | "VIEWER"; roleId: string | null }> {
  const key = await getSetting(organizationId, "security.defaultRoleKey");
  if (SYSTEM_JOIN_ROLES.has(key)) {
    return { role: key as "APPROVER" | "MEMBER" | "VIEWER", roleId: null };
  }
  const custom = await db.role.findFirst({
    where: { organizationId, key, isSystem: false },
    select: { id: true },
  });
  return { role: "MEMBER", roleId: custom?.id ?? null };
}
