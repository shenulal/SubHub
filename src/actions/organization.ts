// src/actions/organization.ts
// Organization Server Actions

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { ensureOrganizationDefaults } from "@/lib/masters/organization-defaults";
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
 * Creates a new organization and makes the user its ADMIN.
 * Redirects unauthenticated users to the login page.
 * @param formData - FormData containing the name field
 * @throws {Error} if the user already belongs to an organization
 * @throws {ZodError} on validation failure
 */
async function _createOrganization(formData: FormData) {
  // Check authentication - redirect to the login page on failure
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check whether the user already has an organization
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (user?.organizationId) {
    throw new Error("You already belong to an organization");
  }

  // Validate input
  const validated = createOrgSchema.parse({
    name: formData.get("name"),
    domain: formData.get("domain"),
  });

  // Domain duplicate check
  const existingOrg = await prisma.organization.findFirst({
    where: { domain: validated.domain },
  });
  if (existingOrg) {
    throw new Error("This domain is already in use");
  }

  // Transaction: create Organization + update User
  await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: validated.name, domain: validated.domain },
    });

    await tx.user.update({
      where: { id: session.user.id },
      data: {
        organizationId: org.id,
        role: "ADMIN", // the organization creator is ADMIN
      },
    });

    // SubHub: seed roles, categories, payment methods, billing cycles, tax rate
    await ensureOrganizationDefaults(org.id, { db: tx });
  });

  revalidatePath("/");
  redirect("/dashboard");
}
export const createOrganization = withLogging(
  "createOrganization",
  _createOrganization
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
