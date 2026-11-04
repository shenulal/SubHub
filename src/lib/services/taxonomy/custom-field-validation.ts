// src/lib/services/taxonomy/custom-field-validation.ts
/**
 * Pure validation of custom-field values against their definitions.
 * Error messages are i18n keys under `taxonomy.customFields.errors.*` so the
 * UI can translate them; the server action returns them unchanged.
 */
import type {
  CustomFieldDefinitionDto,
  CustomFieldValidationResult,
} from "@/types/taxonomy";

export const CUSTOM_FIELD_ERROR_KEYS = {
  required: "required",
  invalidNumber: "invalidNumber",
  invalidDate: "invalidDate",
  invalidOption: "invalidOption",
  unknownField: "unknownField",
  tooLong: "tooLong",
} as const;

export const CUSTOM_FIELD_TEXT_MAX_LENGTH = 500;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function validateOne(
  def: CustomFieldDefinitionDto,
  raw: string | undefined
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return def.isRequired ? CUSTOM_FIELD_ERROR_KEYS.required : null;

  switch (def.fieldType) {
    case "NUMBER":
      return Number.isFinite(Number(value))
        ? null
        : CUSTOM_FIELD_ERROR_KEYS.invalidNumber;
    case "DATE":
      return isValidIsoDate(value) ? null : CUSTOM_FIELD_ERROR_KEYS.invalidDate;
    case "SELECT":
      return (def.options ?? []).includes(value)
        ? null
        : CUSTOM_FIELD_ERROR_KEYS.invalidOption;
    case "TEXT":
    default:
      return value.length > CUSTOM_FIELD_TEXT_MAX_LENGTH
        ? CUSTOM_FIELD_ERROR_KEYS.tooLong
        : null;
  }
}

/**
 * Validates `values` (keyed by field id) against active definitions.
 * Unknown field ids are rejected; missing optional fields are fine.
 */
export function validateCustomFieldValues(
  definitions: CustomFieldDefinitionDto[],
  values: Record<string, string>
): CustomFieldValidationResult {
  const errors: Record<string, string> = {};
  const byId = new Map(definitions.map((d) => [d.id, d]));

  for (const def of definitions) {
    if (def.isArchived) continue;
    const error = validateOne(def, values[def.id]);
    if (error) errors[def.id] = error;
  }
  for (const fieldId of Object.keys(values)) {
    if (!byId.has(fieldId))
      errors[fieldId] = CUSTOM_FIELD_ERROR_KEYS.unknownField;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Derives a snake_case key from a label (`Cost centre code` → `cost_centre_code`). */
export function keyFromLabel(label: string): string {
  const key = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!key) return "field";
  const safe = /^[a-z]/.test(key) ? key : `f_${key}`;
  return safe.slice(0, 40);
}
