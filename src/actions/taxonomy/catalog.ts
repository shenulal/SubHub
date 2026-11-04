// src/actions/taxonomy/catalog.ts
/**
 * Vendor / service catalog actions. The catalog is global (not per-tenant);
 * any authenticated member may search it, `catalog:manage` may edit entries
 * (cancellation guides), and org-level overrides live on `App`.
 */
"use server";

import { revalidatePath } from "next/cache";

import { requireOrganization } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  CATALOG_SEARCH_DEFAULT_LIMIT,
  CATALOG_SEARCH_MAX_LIMIT,
  normalizeQuery,
  rankCatalogItems,
  toStringArray,
} from "@/lib/services/taxonomy/catalog-search";
import { toNumberOrNull } from "@/lib/services/taxonomy/category-tree";
import {
  appCancellationOverrideSchema,
  updateCatalogItemSchema,
  type AppCancellationOverrideInput,
  type UpdateCatalogItemInput,
} from "@/lib/validations/taxonomy";
import type { ActionState } from "@/types";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";
import { Prisma } from "@prisma/client";

import {
  TAXONOMY_PATHS,
  toActionError,
  validationFailure,
  writeAudit,
} from "./_shared";

const CANDIDATE_POOL = 200;

type DbCatalog = {
  id: string;
  name: string;
  slug: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  vendorName: string | null;
  pricingModel: string | null;
  basePricePerSeat: { toNumber(): number } | null;
  basePriceCurrency: string | null;
  aliases: string[];
  cancellationUrl: string | null;
  billingPortalUrl: string | null;
  cancellationSteps: unknown;
  noticePeriodDays: number | null;
  countryCode: string | null;
  isActive: boolean;
};

function toDto(c: DbCatalog): CatalogItemDto {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    category: c.category,
    subcategory: c.subcategory,
    description: c.description,
    logoUrl: c.logoUrl,
    website: c.website,
    vendorName: c.vendorName,
    pricingModel: c.pricingModel,
    basePricePerSeat: toNumberOrNull(c.basePricePerSeat),
    basePriceCurrency: c.basePriceCurrency,
    aliases: c.aliases,
    cancellationUrl: c.cancellationUrl,
    billingPortalUrl: c.billingPortalUrl,
    cancellationSteps: toStringArray(c.cancellationSteps),
    noticePeriodDays: c.noticePeriodDays,
    countryCode: c.countryCode,
    isActive: c.isActive,
  };
}

/** Prefix/contains match on name and aliases (aliases are a text[] column). */
export async function searchCatalog(
  query: string,
  limit = CATALOG_SEARCH_DEFAULT_LIMIT
): Promise<CatalogItemDto[]> {
  try {
    await requireOrganization();
    const q = normalizeQuery(query);
    if (!q) return [];
    const like = `%${q}%`;
    const ids = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM saas_catalog
      WHERE is_active = true
        AND (name ILIKE ${like} OR slug ILIKE ${like}
             OR EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE a ILIKE ${like}))
      LIMIT ${CANDIDATE_POOL}`);
    if (ids.length === 0) return [];
    const rows = await prisma.saaSCatalog.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
    });
    return rankCatalogItems(
      rows.map(toDto),
      q,
      Math.min(limit, CATALOG_SEARCH_MAX_LIMIT)
    );
  } catch (error) {
    toActionError(error, "searchCatalog");
    return [];
  }
}

export async function getCatalogItem(
  id: string
): Promise<CatalogItemDto | null> {
  try {
    await requireOrganization();
    const row = await prisma.saaSCatalog.findUnique({ where: { id } });
    return row ? toDto(row) : null;
  } catch (error) {
    toActionError(error, "getCatalogItem");
    return null;
  }
}

async function _updateCatalogItem(
  id: string,
  input: UpdateCatalogItemInput
): Promise<ActionState<CatalogItemDto>> {
  try {
    const { organizationId, userId } =
      await requirePermission("catalog:manage");
    const parsed = updateCatalogItemSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;
    const existing = await prisma.saaSCatalog.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Catalog entry not found" };
    const updated = await prisma.saaSCatalog.update({
      where: { id },
      data: {
        ...(data.cancellationUrl !== undefined && {
          cancellationUrl: data.cancellationUrl,
        }),
        ...(data.billingPortalUrl !== undefined && {
          billingPortalUrl: data.billingPortalUrl,
        }),
        ...(data.cancellationSteps !== undefined && {
          cancellationSteps: data.cancellationSteps,
        }),
        ...(data.noticePeriodDays !== undefined && {
          noticePeriodDays: data.noticePeriodDays,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_CATALOG_ITEM",
      entityType: "SaaSCatalog",
      entityId: id,
      changes: { ...data },
    });
    revalidatePath(TAXONOMY_PATHS.subscriptions);
    return {
      success: true,
      data: toDto(updated),
      message: "Catalog entry updated",
    };
  } catch (error) {
    return toActionError(error, "updateCatalogItem");
  }
}
export const updateCatalogItem = withLogging(
  "updateCatalogItem",
  _updateCatalogItem
);

/** Org-level cancellation override stored on the App row. */
async function _setAppCancellationOverride(
  appId: string,
  input: AppCancellationOverrideInput
): Promise<ActionState<AppCancellationOverride>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "subscriptions:update"
    );
    const parsed = appCancellationOverrideSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;
    const app = await prisma.app.findFirst({
      where: { id: appId, organizationId },
      select: { id: true },
    });
    if (!app) return { success: false, error: "App not found" };
    const updated = await prisma.app.update({
      where: { id: appId },
      data: {
        ...(data.cancellationUrl !== undefined && {
          cancellationUrl: data.cancellationUrl,
        }),
        ...(data.cancellationNotes !== undefined && {
          cancellationNotes: data.cancellationNotes,
        }),
      },
      select: { cancellationUrl: true, cancellationNotes: true },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "SET_APP_CANCELLATION_OVERRIDE",
      entityType: "App",
      entityId: appId,
      changes: { ...data },
    });
    revalidatePath(TAXONOMY_PATHS.subscriptions);
    return {
      success: true,
      data: updated,
      message: "Cancellation details saved",
    };
  } catch (error) {
    return toActionError(error, "setAppCancellationOverride");
  }
}
export const setAppCancellationOverride = withLogging(
  "setAppCancellationOverride",
  _setAppCancellationOverride
);
