// src/actions/taxonomy/catalog-dto.ts
/** Maps SaaSCatalog rows to the client DTO (not a "use server" module). */
import { toStringArray } from "@/lib/services/taxonomy/catalog-search";
import { toNumberOrNull } from "@/lib/services/taxonomy/category-tree";
import type { CatalogItemDto } from "@/types/taxonomy";

export type DbCatalog = {
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

export function catalogToDto(c: DbCatalog): CatalogItemDto {
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
