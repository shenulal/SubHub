// src/types/taxonomy.ts
/**
 * Shared DTOs for the Taxonomy & Vendor Catalog area
 * (categories, tags, custom fields, SaaS catalog, auto-categorisation).
 * Other feature areas import these — keep the shapes stable.
 */

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  isDefault: boolean;
  sortOrder: number;
  budgetMonthly: number | null;
  children: CategoryNode[];
  /** Subscriptions directly assigned to this category (management UI only). */
  usageCount?: number;
}

export interface CategoryPath {
  parent: { id: string; name: string } | null;
  child: { id: string; name: string };
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string | null;
  color: string | null;
  isArchived: boolean;
  isDefault: boolean;
  sortOrder: number;
  budgetMonthly: number | null;
  usageCount?: number;
}

export interface TagDto {
  id: string;
  name: string;
  color: string | null;
  usageCount?: number;
}

export type CustomFieldTypeValue = "TEXT" | "NUMBER" | "DATE" | "SELECT";

export interface CustomFieldDefinitionDto {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldTypeValue;
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
  isArchived?: boolean;
  usageCount?: number;
}

export interface CustomFieldValidationResult {
  ok: boolean;
  errors: Record<string, string>;
}

export interface CatalogItemDto {
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
  basePricePerSeat: number | null;
  basePriceCurrency: string | null;
  aliases: string[];
  cancellationUrl: string | null;
  billingPortalUrl: string | null;
  cancellationSteps: string[];
  noticePeriodDays: number | null;
  countryCode: string | null;
  isActive: boolean;
}

export interface AppCancellationOverride {
  cancellationUrl: string | null;
  cancellationNotes: string | null;
}

export interface CategorySuggestion {
  categoryId: string | null;
  parentId: string | null;
  confidence: number;
  reason: string;
}

export interface CategorySuggestionInput {
  serviceName: string;
  catalogCategory?: string | null;
  vendorDomain?: string | null;
}

export interface CategorySpendRow {
  categoryId: string;
  name: string;
  parentName: string | null;
  monthlyTotal: number;
  currency: string;
  count: number;
}
