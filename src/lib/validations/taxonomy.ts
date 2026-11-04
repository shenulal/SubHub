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
    (v) => v.fieldType !== "SELECT" || (v.options && v.options.length > 0),
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

export const appCancellationOverrideSchema = z.object({
  cancellationUrl: urlSchema,
  cancellationNotes: z.string().trim().max(2000).nullable().optional(),
});
export type AppCancellationOverrideInput = z.infer<
  typeof appCancellationOverrideSchema
>;
