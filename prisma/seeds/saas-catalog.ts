// prisma/seeds/saas-catalog.ts
/**
 * Global SaaS / vendor catalog seed (≥120 common services) with category +
 * subcategory strings that match the default tree in
 * `src/lib/masters/organization-defaults.ts`, aliases, list pricing and
 * cancellation guides. Idempotent: upserts by slug and never deletes.
 *
 * Data lives in `./saas-catalog/*.ts`; each entry only names its subcategory —
 * the parent category is derived from `SUBCATEGORY_PARENT`.
 */
import type { PrismaClient } from "@prisma/client";

import { BUSINESS_MEDIA_SEED } from "./saas-catalog/business-media";
import { INFRASTRUCTURE_SEED } from "./saas-catalog/infrastructure";
import { SOFTWARE_A_SEED } from "./saas-catalog/software-a";
import { SOFTWARE_B_SEED } from "./saas-catalog/software-b";
import {
  SUBCATEGORY_PARENT,
  type CatalogSeedEntry,
} from "./saas-catalog/types";

export {
  SUBCATEGORY_PARENT,
  type CatalogSeedEntry,
} from "./saas-catalog/types";

export const SAAS_CATALOG_SEED: CatalogSeedEntry[] = [
  ...SOFTWARE_A_SEED,
  ...SOFTWARE_B_SEED,
  ...INFRASTRUCTURE_SEED,
  ...BUSINESS_MEDIA_SEED,
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function logoUrlFor(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export interface CatalogRow {
  name: string;
  slug: string;
  category: string;
  subcategory: string;
  description: string | null;
  logoUrl: string;
  website: string;
  vendorName: string;
  isVerified: boolean;
  pricingModel: string | null;
  basePricePerSeat: number | null;
  basePriceCurrency: string;
  aliases: string[];
  cancellationUrl: string | null;
  billingPortalUrl: string | null;
  cancellationSteps: string[];
  noticePeriodDays: number | null;
  countryCode: string | null;
  isActive: boolean;
}

/** Normalises a compact seed entry into a full catalog row. */
export function toCatalogRow(entry: CatalogSeedEntry): CatalogRow {
  const category = SUBCATEGORY_PARENT[entry.sub];
  if (!category)
    throw new Error(`Unknown subcategory "${entry.sub}" for ${entry.name}`);
  return {
    name: entry.name,
    slug: entry.slug ?? slugify(entry.name),
    category,
    subcategory: entry.sub,
    description: entry.description ?? null,
    logoUrl: logoUrlFor(entry.domain),
    website: `https://${entry.domain}`,
    vendorName: entry.vendor ?? entry.name,
    isVerified: true,
    pricingModel: entry.pricing ?? null,
    basePricePerSeat: entry.price ?? null,
    basePriceCurrency: "USD",
    aliases: Array.from(new Set([...(entry.aliases ?? []), entry.domain])),
    cancellationUrl: entry.cancelUrl ?? null,
    billingPortalUrl: entry.portalUrl ?? null,
    cancellationSteps: entry.steps,
    noticePeriodDays: entry.noticeDays ?? null,
    countryCode: entry.country ?? null,
    isActive: true,
  };
}

/** Validates the dataset: unique slugs, known subcategories, 3–5 steps each. */
export function validateCatalogSeed(entries: CatalogSeedEntry[]): string[] {
  const problems: string[] = [];
  const slugs = new Set<string>();
  for (const entry of entries) {
    const slug = entry.slug ?? slugify(entry.name);
    if (slugs.has(slug)) problems.push(`duplicate slug: ${slug}`);
    slugs.add(slug);
    if (!SUBCATEGORY_PARENT[entry.sub])
      problems.push(`unknown subcategory: ${entry.name} → ${entry.sub}`);
    if (entry.steps.length < 3 || entry.steps.length > 5)
      problems.push(`steps out of range: ${entry.name}`);
  }
  return problems;
}

export async function seedSaasCatalog(prisma: PrismaClient): Promise<number> {
  const problems = validateCatalogSeed(SAAS_CATALOG_SEED);
  if (problems.length > 0)
    throw new Error(`saas-catalog seed invalid:\n${problems.join("\n")}`);

  let count = 0;
  for (const entry of SAAS_CATALOG_SEED) {
    const row = toCatalogRow(entry);
    const { slug, name, ...rest } = row;
    // `name` is also unique: reuse an existing row with the same name but a different slug.
    const byName = await prisma.saaSCatalog.findUnique({
      where: { name },
      select: { slug: true },
    });
    const where = byName && byName.slug !== slug ? { name } : { slug };
    await prisma.saaSCatalog.upsert({
      where,
      create: { slug, name, ...rest },
      update: { name, ...rest, slug },
    });
    count += 1;
  }
  return count;
}
