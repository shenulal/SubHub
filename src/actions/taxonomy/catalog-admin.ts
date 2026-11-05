// src/actions/taxonomy/catalog-admin.ts
/**
 * Vendor catalog administration (Master data → Vendor catalog). The catalog is
 * platform-wide (no organisationId): `catalog:read` may browse it, and
 * `catalog:manage` may create, edit, activate and deactivate entries
 * (platform-only in SaaS mode — the super-admin console). Audit rows are written
 * against the caller's organisation, or the platform audit log for a SUPER_ADMIN.
 */
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { auditPlatformChange } from "@/lib/platform-audit";
import { requirePlatformActor } from "@/lib/rbac/service";
import { nextUniqueSlug, slugify } from "@/lib/services/taxonomy/category-tree";
import { getSetting, getSystemSetting } from "@/lib/settings/service";
import {
  catalogEntryInputSchema,
  catalogListQuerySchema,
  type CatalogEntryInput,
} from "@/lib/validations/taxonomy";
import type { ActionState } from "@/types";
import type { CatalogItemDto } from "@/types/taxonomy";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { toActionError, validationFailure } from "./_shared";
import { catalogToDto } from "./catalog-dto";

const MASTERS_PATH = "/settings/masters";
const PLATFORM_MASTERS_PATH = "/super-admin/masters";

function revalidateMasters() {
  revalidatePath(MASTERS_PATH);
  revalidatePath(PLATFORM_MASTERS_PATH);
}
const ENTITY = "SaaSCatalog";

export interface CatalogPage {
  items: CatalogItemDto[];
  total: number;
  page: number;
  pageSize: number;
  /** Distinct catalog categories, for the category picker. */
  categories: string[];
}

type ParsedEntry = z.output<typeof catalogEntryInputSchema>;

function entryData(input: ParsedEntry) {
  return {
    name: input.name,
    vendorName: input.vendorName,
    category: input.category,
    subcategory: input.subcategory,
    description: input.description,
    website: input.website,
    pricingModel: input.pricingModel ?? null,
    basePricePerSeat: input.basePricePerSeat ?? null,
    basePriceCurrency: input.basePriceCurrency ?? null,
    aliases: Array.from(new Set(input.aliases)),
    cancellationUrl: input.cancellationUrl,
    billingPortalUrl: input.billingPortalUrl,
    noticePeriodDays: input.noticePeriodDays ?? null,
    countryCode: input.countryCode ?? null,
    isActive: input.isActive,
  };
}

function searchWhere(
  query: string,
  status: "all" | "active" | "inactive"
): Prisma.SaaSCatalogWhereInput {
  const where: Prisma.SaaSCatalogWhereInput = {};
  if (status !== "all") where.isActive = status === "active";
  if (query) {
    const contains = { contains: query, mode: "insensitive" as const };
    where.OR = [
      { name: contains },
      { slug: contains },
      { vendorName: contains },
      { category: contains },
      { aliases: { has: query.toLowerCase() } },
    ];
  }
  return where;
}

/** Validates referenced masters (currency, country) and name uniqueness. */
async function assertReferences(
  input: ParsedEntry,
  excludeId: string | null
): Promise<string | null> {
  const [currency, country, clash] = await Promise.all([
    input.basePriceCurrency
      ? prisma.currency.findUnique({ where: { code: input.basePriceCurrency } })
      : Promise.resolve(true),
    input.countryCode
      ? prisma.country.findUnique({ where: { code: input.countryCode } })
      : Promise.resolve(true),
    prisma.saaSCatalog.findFirst({
      where: {
        name: { equals: input.name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (!currency)
    return `Currency ${input.basePriceCurrency} is not in the currency master`;
  if (!country)
    return `Country ${input.countryCode} is not in the country master`;
  if (clash) return "A catalog entry with this name already exists";
  return null;
}

async function _listCatalogEntries(
  raw: unknown = {}
): Promise<ActionState<CatalogPage>> {
  try {
    const { organizationId } = await requirePlatformActor("catalog:read");
    const parsed = catalogListQuerySchema.safeParse(raw ?? {});
    if (!parsed.success) return validationFailure(parsed.error);
    const { query, page, status } = parsed.data;
    const pageSize = organizationId
      ? await getSetting(organizationId, "discovery.listPageSize")
      : await getSystemSetting("discovery.listPageSize");
    const where = searchWhere(query, status);
    const [rows, total, categories] = await Promise.all([
      prisma.saaSCatalog.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.saaSCatalog.count({ where }),
      prisma.saaSCatalog.findMany({
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);
    return {
      success: true,
      data: {
        items: rows.map(catalogToDto),
        total,
        page,
        pageSize,
        categories: categories.map((c) => c.category),
      },
    };
  } catch (error) {
    return toActionError(error, "listCatalogEntries");
  }
}
export const listCatalogEntries = withLogging(
  "listCatalogEntries",
  _listCatalogEntries
);

async function _createCatalogEntry(
  input: CatalogEntryInput
): Promise<ActionState<CatalogItemDto>> {
  try {
    const actor = await requirePlatformActor("catalog:manage");
    const parsed = catalogEntryInputSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const problem = await assertReferences(parsed.data, null);
    if (problem) return { success: false, error: problem };
    const base = slugify(parsed.data.name);
    const taken = await prisma.saaSCatalog.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    const data = entryData(parsed.data);
    const created = await prisma.saaSCatalog.create({
      data: {
        ...data,
        slug: nextUniqueSlug(
          base,
          taken.map((t) => t.slug)
        ),
      },
    });
    await auditPlatformChange(actor, {
      action: "CREATE_CATALOG_ITEM",
      entityType: ENTITY,
      entityId: created.id,
      changes: { to: { ...data } },
    });
    revalidateMasters();
    return {
      success: true,
      data: catalogToDto(created),
      message: "Catalog entry created",
    };
  } catch (error) {
    return toActionError(error, "createCatalogEntry");
  }
}
export const createCatalogEntry = withLogging(
  "createCatalogEntry",
  _createCatalogEntry
);

async function _editCatalogEntry(
  id: string,
  input: CatalogEntryInput
): Promise<ActionState<CatalogItemDto>> {
  try {
    const actor = await requirePlatformActor("catalog:manage");
    const parsed = catalogEntryInputSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const existing = await prisma.saaSCatalog.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Catalog entry not found" };
    const problem = await assertReferences(parsed.data, id);
    if (problem) return { success: false, error: problem };
    const data = entryData(parsed.data);
    const updated = await prisma.saaSCatalog.update({ where: { id }, data });
    await auditPlatformChange(actor, {
      action: "UPDATE_CATALOG_ITEM",
      entityType: ENTITY,
      entityId: id,
      changes: {
        from: { name: existing.name, category: existing.category },
        to: { ...data },
      },
    });
    revalidateMasters();
    return {
      success: true,
      data: catalogToDto(updated),
      message: "Catalog entry updated",
    };
  } catch (error) {
    return toActionError(error, "editCatalogEntry");
  }
}
export const editCatalogEntry = withLogging(
  "editCatalogEntry",
  _editCatalogEntry
);

async function _setCatalogEntryActive(
  id: string,
  isActive: boolean
): Promise<ActionState> {
  try {
    const actor = await requirePlatformActor("catalog:manage");
    const existing = await prisma.saaSCatalog.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Catalog entry not found" };
    await prisma.saaSCatalog.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });
    await auditPlatformChange(actor, {
      action: isActive ? "ACTIVATE_CATALOG_ITEM" : "DEACTIVATE_CATALOG_ITEM",
      entityType: ENTITY,
      entityId: id,
      changes: { isActive: { from: existing.isActive, to: Boolean(isActive) } },
    });
    revalidateMasters();
    return { success: true };
  } catch (error) {
    return toActionError(error, "setCatalogEntryActive");
  }
}
export const setCatalogEntryActive = withLogging(
  "setCatalogEntryActive",
  _setCatalogEntryActive
);
