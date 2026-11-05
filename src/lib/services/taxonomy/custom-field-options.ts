// src/lib/services/taxonomy/custom-field-options.ts
/**
 * Option-based custom fields. SELECT stores the chosen option as-is;
 * MULTI_SELECT stores the chosen options as a JSON array string so the
 * existing `CustomFieldValue.value` text column (and its search) keeps working.
 */
import type { CustomFieldTypeValue } from "@/types/taxonomy";

export const OPTION_FIELD_TYPES: readonly CustomFieldTypeValue[] = [
  "SELECT",
  "MULTI_SELECT",
];

export function isOptionFieldType(type: CustomFieldTypeValue): boolean {
  return OPTION_FIELD_TYPES.includes(type);
}

/** Decode a stored MULTI_SELECT value; a plain string is one option. */
export function parseMultiSelectValue(
  raw: string | null | undefined
): string[] {
  const value = (raw ?? "").trim();
  if (!value) return [];
  if (value.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set(parsed.filter((v): v is string => typeof v === "string"))
        );
      }
    } catch {
      // Not JSON: fall through and treat it as a single option
    }
  }
  return [value];
}

/** Encode for storage; an empty selection is stored as "" (no value). */
export function serializeMultiSelectValue(values: readonly string[]): string {
  const unique = Array.from(new Set(values.filter(Boolean)));
  return unique.length ? JSON.stringify(unique) : "";
}

/** Human-readable value for detail views and exports. */
export function formatCustomFieldValue(
  fieldType: CustomFieldTypeValue,
  raw: string | null | undefined
): string {
  if (fieldType === "MULTI_SELECT")
    return parseMultiSelectValue(raw).join(", ");
  return raw ?? "";
}
