// src/lib/validations/taxonomy.ts
/** Zod schemas for the taxonomy area (categories, tags, custom fields, catalog). */
import { z } from "zod";

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const FIELD_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

const colorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, "Colour must be a hex value like #6366f1")
  .nullable()
  .optional();

const budgetSchema = z.coerce
  .number()
  .min(0, "Budget cannot be negative")
  .max(1_000_000_000)
  .nullable()
  .optional();

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  parentId: z.string().min(1).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  color: colorSchema,
  budgetMonthly: budgetSchema,
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80).optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  color: colorSchema,
  budgetMonthly: budgetSchema,
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z.object({
  parentId: z.string().min(1).nullable(),
  orderedIds: z.array(z.string().min(1)).min(1),
});
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "Tag name is required")
  .max(40, "Tag name is too long");

export const tagColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, "Colour must be a hex value")
  .nullable();

export const mergeTagsSchema = z.object({
  sourceIds: z.array(z.string().min(1)).min(1),
  targetId: z.string().min(1),
});

export const customFieldTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
]);

const optionsSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(50)
  .nullable()
  .optional();

export const createCustomFieldSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(80),
    key: z
      .string()
      .trim()
      .regex(FIELD_KEY_REGEX, "Key must be snake_case starting with a letter")
      .max(40)
      .optional(),
    fieldType: customFieldTypeSchema,
    options: optionsSchema,
    isRequired: z.boolean().optional().default(false),
  })
  .refine(
    (v) =>
      (v.fieldType !== "SELECT" && v.fieldType !== "MULTI_SELECT") ||
      (v.options && v.options.length > 0),
    { message: "Select fields need at least one option", path: ["options"] }
  );
export type CreateCustomFieldInput = z.input<typeof createCustomFieldSchema>;

export const updateCustomFieldSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  options: optionsSchema,
  isRequired: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;

const urlSchema = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .max(500)
  .nullable()
  .optional();

export const updateCatalogItemSchema = z.object({
  cancellationUrl: urlSchema,
  billingPortalUrl: urlSchema,
  cancellationSteps: z
    .array(z.string().trim().min(1).max(300))
    .max(12)
    .optional(),
  noticePeriodDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .nullable()
    .optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;

/**
 * Pricing models understood by the vendor classifier and seat analytics
 * (`saas-classifier.types.ts`). A code contract, not tenant reference data.
 */
export const CATALOG_PRICING_MODELS = [
  "PER_SEAT",
  "FLAT_RATE",
  "USAGE_BASED",
  "FREEMIUM",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.string().url("Must be a valid URL").nullable());

/** Create / full edit of a vendor catalog entry (`catalog:manage`). */
export const catalogEntryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  vendorName: optionalText(120),
  category: z.string().trim().min(1).max(80),
  subcategory: optionalText(80),
  description: optionalText(500),
  website: optionalUrl,
  pricingModel: z.enum(CATALOG_PRICING_MODELS).nullable().optional(),
  basePricePerSeat: z.coerce
    .number()
    .min(0)
    .max(1_000_000)
    .nullable()
    .optional(),
  basePriceCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "ISO 4217 code expected")
    .nullable()
    .optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  cancellationUrl: optionalUrl,
  billingPortalUrl: optionalUrl,
  noticePeriodDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .nullable()
    .optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 expected")
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});
export type CatalogEntryInput = z.input<typeof catalogEntryInputSchema>;

export const catalogListQuerySchema = z.object({
  query: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).default(1),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export const appCancellationOverrideSchema = z.object({
  cancellationUrl: urlSchema,
  cancellationNotes: z.string().trim().max(2000).nullable().optional(),
});
export type AppCancellationOverrideInput = z.infer<
  typeof appCancellationOverrideSchema
>;
