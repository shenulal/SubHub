// src/actions/super-admin/_tenant.ts
/**
 * Which organisation a super-admin console screen works on.
 *   single-tenant: the installation's only organisation (or an explicit id).
 *   SaaS:          an explicit tenant id is required — there is no "default" tenant.
 * Not a server action module (no "use server").
 */
import { prisma } from "@/lib/db";
import { isSaas } from "@/lib/deployment/mode";

export const NO_TENANT_MESSAGE = "Tenant information not found.";
export const SELECT_TENANT_MESSAGE = "Select a tenant.";

export interface ResolvedTenant {
  id: string;
  name: string;
}

export type TenantResolution =
  | { ok: true; tenant: ResolvedTenant }
  | { ok: false; message: string };

export async function resolveConsoleTenant(
  organizationId?: string | null
): Promise<TenantResolution> {
  const select = { id: true, name: true } as const;
  if (organizationId) {
    const tenant = await prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select,
    });
    return tenant
      ? { ok: true, tenant }
      : { ok: false, message: NO_TENANT_MESSAGE };
  }
  if (isSaas()) return { ok: false, message: SELECT_TENANT_MESSAGE };
  const tenant = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    select,
  });
  return tenant
    ? { ok: true, tenant }
    : { ok: false, message: NO_TENANT_MESSAGE };
}
