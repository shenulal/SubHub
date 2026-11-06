// src/actions/super-admin/tenant-settings.ts
"use server";

/**
 * Tenant (Organization) management for the super-admin console. SUPER_ADMIN only.
 *   single-tenant: at most one tenant — creation is refused once it exists.
 *   SaaS:          list, create, view, edit, deactivate / reactivate tenants.
 * Every change is recorded in the platform audit log.
 */
import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { getDeploymentMode, isSaas } from "@/lib/deployment/mode";
import {
  assertOrganizationCreationAllowed,
  TenancyError,
} from "@/lib/deployment/tenancy";
import { withLogging } from "@/lib/logging";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveConsoleTenant } from "./_tenant";

export interface TenantInfo {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  createdAt: Date;
  deactivatedAt: Date | null;
  userCount: number;
  subscriptionCount: number;
}

const TENANT_SELECT = {
  id: true,
  name: true,
  domain: true,
  logoUrl: true,
  createdAt: true,
  deactivatedAt: true,
  _count: { select: { users: true, subscriptions: true } },
} satisfies Prisma.OrganizationSelect;

type TenantRow = Prisma.OrganizationGetPayload<{
  select: typeof TENANT_SELECT;
}>;

function toTenantInfo(org: TenantRow): TenantInfo {
  return {
    id: org.id,
    name: org.name,
    domain: org.domain,
    logoUrl: org.logoUrl,
    createdAt: org.createdAt,
    deactivatedAt: org.deactivatedAt,
    userCount: org._count.users,
    subscriptionCount: org._count.subscriptions,
  };
}

function revalidateConsole() {
  revalidatePath("/super-admin");
  revalidatePath("/super-admin/tenants");
  revalidatePath("/super-admin/installation");
  revalidatePath("/super-admin/admins");
}

/**
 * The tenant a console screen works on (single-tenant: the only one;
 * SaaS: `organizationId` is required).
 */
async function _getTenantInfo(
  organizationId?: string
): Promise<ActionState<TenantInfo>> {
  await requireSuperAdmin();
  const resolved = await resolveConsoleTenant(organizationId);
  if (!resolved.ok) return { success: false, message: resolved.message };
  const org = await prisma.organization.findUnique({
    where: { id: resolved.tenant.id },
    select: TENANT_SELECT,
  });
  if (!org) return { success: false, message: "Tenant information not found." };
  return { success: true, data: toTenantInfo(org) };
}

export const getTenantInfo = withLogging("getTenantInfo", _getTenantInfo);

/** Every tenant, oldest first (SaaS tenant list; one row in single-tenant). */
async function _listTenants(): Promise<ActionState<TenantInfo[]>> {
  await requireSuperAdmin();
  const rows = await prisma.organization.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: TENANT_SELECT,
  });
  return { success: true, data: rows.map(toTenantInfo) };
}

export const listTenants = withLogging("listTenants", _listTenants);

const DOMAIN_RE = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DOMAIN_MESSAGE = "Please enter a valid domain (e.g. example.com)";

const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Please enter the company name").max(100),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DOMAIN_RE, DOMAIN_MESSAGE)
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

/**
 * Create a tenant with its default roles and masters.
 * Single-tenant: refused once the installation has its organisation.
 */
async function _createTenant(
  name: string,
  domain?: string,
  logoUrl?: string
): Promise<ActionState<TenantInfo>> {
  const { userId } = await requireSuperAdmin();
  const parsed = createTenantSchema.safeParse({ name, domain, logoUrl });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const input = parsed.data;
  if (input.domain) {
    const taken = await prisma.organization.findFirst({
      where: { domain: input.domain },
      select: { id: true },
    });
    if (taken)
      return { success: false, message: "This domain is already in use" };
  }

  try {
    const org = await prisma.$transaction(async (tx) => {
      await assertOrganizationCreationAllowed(tx, { viaSelfSignup: false });
      const created = await tx.organization.create({
        data: {
          name: input.name,
          domain: input.domain || null,
          logoUrl: input.logoUrl || null,
        },
        select: { id: true },
      });
      await ensureOrganizationDefaults(created.id, { db: tx });
      await writePlatformAudit(
        {
          actorId: userId,
          action: "CREATE_TENANT",
          entityType: "Organization",
          entityId: created.id,
          changes: { name: input.name, domain: input.domain || null },
          metadata: { deploymentMode: getDeploymentMode() },
        },
        tx
      );
      return tx.organization.findUniqueOrThrow({
        where: { id: created.id },
        select: TENANT_SELECT,
      });
    });
    revalidateConsole();
    return {
      success: true,
      message: "Tenant created.",
      data: toTenantInfo(org),
    };
  } catch (error) {
    if (error instanceof TenancyError) {
      return { success: false, message: error.message };
    }
    throw error;
  }
}

export const createTenant = withLogging("createTenant", _createTenant);

/** Apply one field change to a tenant and audit it. */
async function updateTenantField(
  orgId: string,
  field: "name" | "domain" | "logoUrl",
  value: string | null
): Promise<ActionState> {
  const { userId } = await requireSuperAdmin();
  const existing = await prisma.organization.findFirst({
    where: { id: orgId, deletedAt: null },
    select: { name: true, domain: true, logoUrl: true },
  });
  if (!existing)
    return { success: false, message: "Tenant information not found." };
  if (field === "domain" && value) {
    const taken = await prisma.organization.findFirst({
      where: { domain: value, id: { not: orgId } },
      select: { id: true },
    });
    if (taken)
      return { success: false, message: "This domain is already in use" };
  }
  await prisma.organization.update({
    where: { id: orgId },
    data: { [field]: value },
  });
  await writePlatformAudit({
    actorId: userId,
    action: "UPDATE_TENANT",
    entityType: "Organization",
    entityId: orgId,
    changes: { [field]: { from: existing[field], to: value } },
  });
  revalidateConsole();
  return { success: true };
}

const updateDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Please enter a domain")
    .regex(DOMAIN_RE, DOMAIN_MESSAGE),
});

/** Update the tenant domain */
async function _updateTenantDomain(
  orgId: string,
  domain: string
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = updateDomainSchema.safeParse({ domain });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const result = await updateTenantField(orgId, "domain", parsed.data.domain);
  return result.success
    ? { success: true, message: "Domain updated." }
    : result;
}

export const updateTenantDomain = withLogging(
  "updateTenantDomain",
  _updateTenantDomain
);

const updateNameSchema = z.object({
  name: z.string().trim().min(1, "Please enter the company name").max(100),
});

/** Update the tenant company name */
async function _updateTenantName(
  orgId: string,
  name: string
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = updateNameSchema.safeParse({ name });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const result = await updateTenantField(orgId, "name", parsed.data.name);
  return result.success
    ? { success: true, message: "Company name updated." }
    : result;
}

export const updateTenantName = withLogging(
  "updateTenantName",
  _updateTenantName
);

const updateLogoSchema = z.object({
  logoUrl: z.string().url("Please enter a valid URL").or(z.literal("")),
});

/** Update the tenant logo URL */
async function _updateTenantLogoUrl(
  orgId: string,
  logoUrl: string
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = updateLogoSchema.safeParse({ logoUrl });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }
  const result = await updateTenantField(
    orgId,
    "logoUrl",
    parsed.data.logoUrl || null
  );
  return result.success
    ? { success: true, message: "Logo URL updated." }
    : result;
}

export const updateTenantLogoUrl = withLogging(
  "updateTenantLogoUrl",
  _updateTenantLogoUrl
);

/**
 * SaaS only: deactivate (suspend) or reactivate a tenant. Data is kept; members
 * lose access while the tenant is deactivated.
 */
async function _setTenantActive(
  orgId: string,
  active: boolean
): Promise<ActionState> {
  const { userId } = await requireSuperAdmin();
  if (!isSaas()) {
    return {
      success: false,
      message:
        "Tenants can only be deactivated in SaaS mode. A single-tenant installation has exactly one organisation.",
    };
  }
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { deactivatedAt: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt)
    return { success: false, message: "Tenant information not found." };
  const deactivatedAt = active ? null : (existing.deactivatedAt ?? new Date());
  await prisma.organization.update({
    where: { id: orgId },
    data: { deactivatedAt },
  });
  await writePlatformAudit({
    actorId: userId,
    action: active ? "REACTIVATE_TENANT" : "DEACTIVATE_TENANT",
    entityType: "Organization",
    entityId: orgId,
    changes: {
      deactivatedAt: {
        from: existing.deactivatedAt?.toISOString() ?? null,
        to: deactivatedAt?.toISOString() ?? null,
      },
    },
  });
  revalidateConsole();
  return {
    success: true,
    message: active ? "Tenant reactivated." : "Tenant deactivated.",
  };
}

export const setTenantActive = withLogging("setTenantActive", _setTenantActive);
