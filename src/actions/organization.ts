// src/actions/organization.ts
// Organization Server Actions

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDeploymentMode } from "@/lib/deployment/mode";
import {
  assertOrganizationCreationAllowed,
  emailDomain,
  findDomainJoinOrganization,
  resolveDomainJoinRole,
  TenancyError,
} from "@/lib/deployment/tenancy";
import { withLogging } from "@/lib/logging";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

/**
 * Organization creation schema
 */
const createOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(50),
  domain: z
    .string()
    .min(1, "Domain is required")
    .regex(
      /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Invalid domain format (e.g. company.com)"
    ),
});

const updateOrgSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters")
    .max(50),
  domain: z
    .string()
    .regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format")
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(200, "Address must be 200 characters or fewer")
    .optional()
    .or(z.literal("")),
});

/**
 * Creates a new organization and makes the user its ADMIN (onboarding).
 * Deployment mode decides whether this is allowed: single-tenant → only the
 * first-run setup (no organisation yet); SaaS → when `system.allowSelfSignup`.
 * Returns an ActionState on failure; redirects to the dashboard on success.
 */
async function _createOrganization(formData: FormData): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (user?.organizationId) {
    return { success: false, error: "You already belong to an organization" };
  }

  const parsed = createOrgSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please check your input",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const validated = parsed.data;

  const existingOrg = await prisma.organization.findFirst({
    where: { domain: validated.domain },
  });
  if (existingOrg) {
    return { success: false, error: "This domain is already in use" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Single-tenant: lock + re-check so only the first-run setup succeeds.
      await assertOrganizationCreationAllowed(tx, { viaSelfSignup: true });
      const org = await tx.organization.create({
        data: { name: validated.name, domain: validated.domain },
      });
      await tx.user.update({
        where: { id: userId },
        data: { organizationId: org.id, role: "ADMIN" },
      });
      // SubHub: seed roles, categories, payment methods, billing cycles, tax rate
      await ensureOrganizationDefaults(org.id, { db: tx });
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          userId,
          action: "CREATE_ORGANIZATION",
          entityType: "Organization",
          entityId: org.id,
          changes: { name: validated.name, domain: validated.domain },
          metadata: { deploymentMode: getDeploymentMode() },
        },
      });
    });
  } catch (error) {
    if (error instanceof TenancyError) {
      return { success: false, error: error.message };
    }
    throw error;
  }

  revalidatePath("/");
  redirect("/dashboard");
}
export const createOrganization = withLogging(
  "createOrganization",
  _createOrganization
);

/**
 * Joins the organisation that accepts the user's email domain (domain auto-join).
 * Requires `system.allowSelfSignup`; SaaS only matches an organisation's claimed
 * primary domain. The user gets the organisation's default role
 * (`security.defaultRoleKey`, never ADMIN).
 */
async function _joinOrganizationByDomain(): Promise<ActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, email: true },
  });
  if (!user) redirect("/login");
  if (user.organizationId) {
    return { success: false, error: "You already belong to an organization" };
  }
  const org = await findDomainJoinOrganization(user.email);
  if (!org) {
    return {
      success: false,
      error: "No organisation accepts sign-ups from your email domain.",
    };
  }

  const { role, roleId } = await resolveDomainJoinRole(org.id);
  await prisma.$transaction(async (tx) => {
    const joined = await tx.user.updateMany({
      where: { id: userId, organizationId: null },
      data: { organizationId: org.id, role, roleId },
    });
    if (joined.count === 0) return;
    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        userId,
        action: "JOIN_ORGANIZATION_BY_DOMAIN",
        entityType: "User",
        entityId: userId,
        metadata: { domain: emailDomain(user.email), role, roleId },
      },
    });
  });

  revalidatePath("/");
  redirect("/dashboard");
}
export const joinOrganizationByDomain = withLogging(
  "joinOrganizationByDomain",
  _joinOrganizationByDomain
);

/**
 * Update organization details (currently name only)
 */
async function _updateOrganization(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  if (session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Only admins can update organization details",
    };
  }

  const validated = updateOrgSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    logoUrl: formData.get("logoUrl"),
  });

  if (!validated.success) {
    return {
      success: false,
      message: "Please check your input",
      errors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const current = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });
  const currentSettings =
    (current?.settings as Record<string, unknown> | null) ?? {};
  const addressInput = formData.get("address");
  const address =
    typeof addressInput === "string" && addressInput.length > 0
      ? addressInput
      : ((currentSettings.address as string | undefined) ?? "");

  // Domain duplicate check (only when not empty)
  if (validated.data.domain) {
    const existingOrg = await prisma.organization.findFirst({
      where: {
        domain: validated.data.domain,
        id: { not: session.user.organizationId },
      },
    });
    if (existingOrg) {
      return { success: false, message: "This domain is already in use" };
    }
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name: validated.data.name,
      // Skip the update for an empty string (avoids the unique constraint)
      ...(validated.data.domain ? { domain: validated.data.domain } : {}),
      logoUrl: validated.data.logoUrl || null,
      settings: { ...currentSettings, address },
    },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/settings");

  return { success: true, message: "Organization details updated" };
}
export const updateOrganization = withLogging(
  "updateOrganization",
  _updateOrganization
);

/**
 * Update the organization's team/department list
 * Stored in the settings.teams array.
 */
async function _updateOrganizationTeams(teams: string[]) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  if (session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Only admins can manage teams/departments",
    };
  }

  // Validate team names
  const validTeams = teams
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 50);

  // Remove duplicates
  const uniqueTeams = [...new Set(validTeams)];

  const current = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { settings: true },
  });
  const currentSettings =
    (current?.settings as Record<string, unknown> | null) ?? {};

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      settings: { ...currentSettings, teams: uniqueTeams },
    },
  });

  revalidatePath("/settings/organization");

  return { success: true, message: "Teams/departments updated" };
}
export const updateOrganizationTeams = withLogging(
  "updateOrganizationTeams",
  _updateOrganizationTeams
);

/**
 * Update the organization's additional domain list
 * Stored in the settings.domains array.
 * Entries identical to the primary domain (organization.domain) are filtered out automatically.
 */
const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

async function _updateOrganizationDomains(domains: string[]) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  if (session.user.role !== "ADMIN") {
    return {
      success: false,
      message: "Only admins can manage domains",
    };
  }

  const current = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { domain: true, settings: true },
  });

  const primaryDomain = current?.domain?.toLowerCase() || "";
  const currentSettings =
    (current?.settings as Record<string, unknown> | null) ?? {};

  // Validate and normalize domains
  const validDomains = domains
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0 && domainRegex.test(d))
    .filter((d) => d !== primaryDomain); // remove entries identical to the primary domain

  // Remove duplicates
  const uniqueDomains = [...new Set(validDomains)];

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      settings: { ...currentSettings, domains: uniqueDomains },
    },
  });

  revalidatePath("/settings/organization");

  return { success: true, message: "Domains updated" };
}
export const updateOrganizationDomains = withLogging(
  "updateOrganizationDomains",
  _updateOrganizationDomains
);
