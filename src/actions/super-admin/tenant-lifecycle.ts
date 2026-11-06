// src/actions/super-admin/tenant-lifecycle.ts
"use server";

/**
 * Control Panel — create a tenant together with its first Tenant Admin, and
 * delete (soft) a tenant. Platform super admins only; audited on the platform log.
 *   single-tenant: creation only while the installation has no organisation.
 *   saas:          any number of tenants (subject to the licence, read through
 *                  `@/lib/licensing`); deletion with typed-name confirmation.
 */
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";
import { getDeploymentMode, isSaas } from "@/lib/deployment/mode";
import {
  assertOrganizationCreationAllowed,
  TenancyError,
} from "@/lib/deployment/tenancy";
import { checkLimit } from "@/lib/licensing";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import { writePlatformAudit } from "@/lib/platform-audit";
import type { PlatformAdminActor } from "@/lib/platform/guard";
import { getSystemSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { platformAction } from "./_action";
import {
  adminEmailConflict,
  deliverAdminInvitation,
  invitationExpiry,
  provisionTenantAdmin,
  resolveAdminPassword,
  tenantAdminSchema,
  type ProvisionedAdmin,
} from "./_tenant-admin";

const DOMAIN_RE = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Enter the organisation name").max(100),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(DOMAIN_RE, "Enter a valid domain (e.g. example.com)")
    .optional()
    .or(z.literal("")),
  countryCode: z.string().regex(/^[A-Z]{2}$/, "Choose a country"),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
  timezone: z.string().refine(isTimeZone, "Choose a valid time zone"),
  admin: tenantAdminSchema,
});

export type CreateTenantInput = z.input<typeof createSchema>;
type ParsedCreate = z.output<typeof createSchema>;

export interface CreatedTenant {
  id: string;
  name: string;
  admin: ProvisionedAdmin;
}

function revalidatePanel() {
  for (const p of [
    "/super-admin",
    "/super-admin/tenants",
    "/super-admin/installation",
  ]) {
    revalidatePath(p);
  }
}

/** Masters + uniqueness + licence checks; returns an error message or null. */
async function precheckCreate(input: ParsedCreate): Promise<string | null> {
  const [country, currency] = await Promise.all([
    prisma.country.findFirst({
      where: { code: input.countryCode, isActive: true },
      select: { code: true },
    }),
    prisma.currency.findFirst({
      where: { code: input.baseCurrency, isActive: true },
      select: { code: true },
    }),
  ]);
  if (!country) return "The selected country is not an active master record.";
  if (!currency) return "The selected currency is not an active master record.";
  if (input.domain) {
    const taken = await prisma.organization.findFirst({
      where: { domain: input.domain },
      select: { id: true },
    });
    if (taken) return "This domain is already in use";
  }
  const conflict = await adminEmailConflict(
    input.admin.email,
    null,
    input.admin.method
  );
  if (conflict) return conflict;
  const tenants = await prisma.organization.count({
    where: { deletedAt: null },
  });
  const verdict = await checkLimit("maxTenants", tenants);
  return verdict.allowed ? null : verdict.reason;
}

/** Organisation defaults chosen in the form, stored as organisation settings. */
async function organizationSettingRows(
  organizationId: string,
  input: ParsedCreate,
  actorId: string
): Promise<Prisma.OrganizationSettingCreateManyInput[]> {
  const enabled = await getSystemSetting("finance.enabledCurrencies");
  const values: Record<string, Prisma.InputJsonValue> = {
    "general.countryCode": input.countryCode,
    "finance.baseCurrency": input.baseCurrency,
    "general.timezone": input.timezone,
  };
  if (!enabled.includes(input.baseCurrency)) {
    values["finance.enabledCurrencies"] = [input.baseCurrency, ...enabled];
  }
  return Object.entries(values).map(([key, value]) => ({
    organizationId,
    key,
    value,
    updatedById: actorId,
  }));
}

async function createInTransaction(
  actor: PlatformAdminActor,
  input: ParsedCreate,
  passwordHash: string | null,
  invitationDays: number
) {
  return prisma.$transaction(async (tx) => {
    await assertOrganizationCreationAllowed(tx, { viaSelfSignup: false });
    const org = await tx.organization.create({
      data: { name: input.name, domain: input.domain || null },
      select: { id: true, name: true },
    });
    await tx.organizationSetting.createMany({
      data: await organizationSettingRows(org.id, input, actor.userId),
    });
    await ensureOrganizationDefaults(org.id, {
      db: tx,
      countryCode: input.countryCode,
    });
    await writePlatformAudit(
      {
        actorId: actor.userId,
        action: "CREATE_TENANT",
        entityType: "Organization",
        entityId: org.id,
        changes: {
          name: input.name,
          domain: input.domain || null,
          countryCode: input.countryCode,
          baseCurrency: input.baseCurrency,
          timezone: input.timezone,
        },
        metadata: {
          deploymentMode: getDeploymentMode(),
          organizationId: org.id,
        },
      },
      tx
    );
    const admin = await provisionTenantAdmin(tx, {
      organizationId: org.id,
      actorId: actor.userId,
      admin: input.admin,
      passwordHash,
      invitationExpiresAt: invitationExpiry(invitationDays),
    });
    return { org, admin };
  });
}

async function _createTenantWithAdmin(
  actor: PlatformAdminActor,
  raw: CreateTenantInput
): Promise<ActionState<CreatedTenant>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check your input",
    };
  }
  const input = parsed.data;
  const problem = await precheckCreate(input);
  if (problem) return { success: false, error: problem };

  const [password, invitationDays] = await Promise.all([
    // The tenant does not exist yet: the platform (system) password policy applies.
    resolveAdminPassword(input.admin, null),
    getSystemSetting("security.invitationExpiryDays"),
  ]);
  if (!password.ok) return { success: false, error: password.message };
  const passwordHash = password.password
    ? await hashPassword(password.password)
    : null;

  try {
    const { org, admin } = await createInTransaction(
      actor,
      input,
      passwordHash,
      invitationDays
    );
    const delivered = await deliverAdminInvitation(admin, org.name);
    revalidatePanel();
    return {
      success: true,
      message: "Tenant created.",
      data: {
        id: org.id,
        name: org.name,
        admin: password.generated
          ? { ...delivered, temporaryPassword: password.password! }
          : delivered,
      },
    };
  } catch (error) {
    if (error instanceof TenancyError)
      return { success: false, error: error.message };
    throw error;
  }
}

export const createTenantWithAdmin = platformAction(
  "createTenantWithAdmin",
  _createTenantWithAdmin
);

const deleteSchema = z.object({
  organizationId: z.string().min(1),
  confirmName: z.string(),
});

/**
 * SaaS only. Soft delete: the tenant is hidden, stays deactivated (members lose
 * access), its domain is released and pending invitations are cancelled. Data is
 * kept for retention and can be purged by a database operator later.
 */
async function _deleteTenant(
  actor: PlatformAdminActor,
  raw: z.input<typeof deleteSchema>
): Promise<ActionState> {
  if (!isSaas()) {
    return {
      success: false,
      error:
        "A single-tenant installation keeps its one organisation. Deleting it is not available.",
    };
  }
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "Select a tenant." };
  const org = await prisma.organization.findFirst({
    where: { id: parsed.data.organizationId, deletedAt: null },
    select: { id: true, name: true, domain: true, deactivatedAt: true },
  });
  if (!org) return { success: false, error: "Tenant information not found." };
  if (parsed.data.confirmName.trim() !== org.name) {
    return {
      success: false,
      error: "Type the tenant name exactly to confirm.",
    };
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: org.id },
      data: {
        deletedAt: now,
        deactivatedAt: org.deactivatedAt ?? now,
        domain: null,
      },
    });
    await tx.invitation.updateMany({
      where: { organizationId: org.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await writePlatformAudit(
      {
        actorId: actor.userId,
        action: "DELETE_TENANT",
        entityType: "Organization",
        entityId: org.id,
        changes: {
          name: org.name,
          domain: org.domain,
          deletedAt: now.toISOString(),
        },
        metadata: { mode: "soft-delete", organizationId: org.id },
      },
      tx
    );
  });
  revalidatePanel();
  return { success: true, message: `${org.name} was deleted.` };
}

export const deleteTenant = platformAction("deleteTenant", _deleteTenant);
