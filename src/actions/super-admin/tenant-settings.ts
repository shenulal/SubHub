// src/actions/super-admin/tenant-settings.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import type { ActionState } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface TenantInfo {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  createdAt: Date;
  userCount: number;
  subscriptionCount: number;
}

/**
 * Fetch the current tenant (Organization)
 * SUPER_ADMIN only
 */
async function _getTenantInfo(): Promise<ActionState<TenantInfo>> {
  await requireSuperAdmin();

  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          subscriptions: true,
        },
      },
    },
  });

  if (!org) {
    return { success: false, message: "Tenant information not found." };
  }

  return {
    success: true,
    data: {
      id: org.id,
      name: org.name,
      domain: org.domain,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      userCount: org._count.users,
      subscriptionCount: org._count.subscriptions,
    },
  };
}

export const getTenantInfo = withLogging("getTenantInfo", _getTenantInfo);

const createTenantSchema = z.object({
  name: z.string().min(1, "Please enter the company name").max(100),
  domain: z
    .string()
    .regex(
      /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please enter a valid domain (e.g. example.com)"
    )
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
});

/**
 * Create a new tenant (Organization)
 * SUPER_ADMIN only
 */
async function _createTenant(
  name: string,
  domain?: string,
  logoUrl?: string
): Promise<ActionState<TenantInfo>> {
  await requireSuperAdmin();

  const parsed = createTenantSchema.safeParse({ name, domain, logoUrl });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain || null,
      logoUrl: parsed.data.logoUrl || null,
    },
    include: {
      _count: { select: { users: true, subscriptions: true } },
    },
  });

  revalidatePath("/super-admin");
  revalidatePath("/super-admin/tenant");
  revalidatePath("/super-admin/admins");

  return {
    success: true,
    message: "Tenant created.",
    data: {
      id: org.id,
      name: org.name,
      domain: org.domain,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      userCount: org._count.users,
      subscriptionCount: org._count.subscriptions,
    },
  };
}

export const createTenant = withLogging("createTenant", _createTenant);

const updateDomainSchema = z.object({
  domain: z
    .string()
    .min(1, "Please enter a domain")
    .regex(
      /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Please enter a valid domain (e.g. example.com)"
    ),
});

/**
 * Update the tenant domain
 */
async function _updateTenantDomain(
  orgId: string,
  domain: string
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = updateDomainSchema.safeParse({ domain });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0].message,
    };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { domain: parsed.data.domain },
  });

  revalidatePath("/super-admin/tenant");
  return { success: true, message: "Domain updated." };
}

export const updateTenantDomain = withLogging(
  "updateTenantDomain",
  _updateTenantDomain
);

const updateNameSchema = z.object({
  name: z.string().min(1, "Please enter the company name").max(100),
});

/**
 * Update the tenant company name
 */
async function _updateTenantName(
  orgId: string,
  name: string
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = updateNameSchema.safeParse({ name });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/super-admin/tenant");
  return { success: true, message: "Company name updated." };
}

export const updateTenantName = withLogging(
  "updateTenantName",
  _updateTenantName
);

const updateLogoSchema = z.object({
  logoUrl: z.string().url("Please enter a valid URL").or(z.literal("")),
});

/**
 * Update the tenant logo URL
 */
async function _updateTenantLogoUrl(
  orgId: string,
  logoUrl: string
): Promise<ActionState> {
  await requireSuperAdmin();

  const parsed = updateLogoSchema.safeParse({ logoUrl });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0].message };
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { logoUrl: parsed.data.logoUrl || null },
  });

  revalidatePath("/super-admin/tenant");
  return { success: true, message: "Logo URL updated." };
}

export const updateTenantLogoUrl = withLogging(
  "updateTenantLogoUrl",
  _updateTenantLogoUrl
);
