// src/actions/subscriptions/taxonomy-adapter.ts
/**
 * Adapter over the taxonomy area's server actions (owned by the taxonomy agent).
 * Subscription actions import from here so tests can mock one surface and the
 * return shapes are normalised in a single place.
 */
// Dynamic imports keep this adapter loadable (and mockable) while the taxonomy
// modules are still being written by the taxonomy agent.
async function tagsModule() {
  return import("@/actions/taxonomy/tags");
}
async function customFieldsModule() {
  return import("@/actions/taxonomy/custom-fields");
}

export interface EnsuredTag {
  id: string;
  name: string;
}

function extractList<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "data" in result) {
    const data = (result as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

/** Find-or-create tags by name in the current organisation; returns their ids. */
export async function ensureTags(names: string[]): Promise<EnsuredTag[]> {
  const cleaned = Array.from(
    new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))
  );
  if (cleaned.length === 0) return [];
  const { ensureTags: ensureTagsAction } = await tagsModule();
  const result: unknown = await ensureTagsAction(cleaned);
  return extractList<EnsuredTag>(result);
}

export interface CustomFieldValidation {
  success: boolean;
  errors?: Record<string, string[]>;
}

/** Validate custom-field values against the organisation's definitions. */
export async function validateCustomFieldValues(
  values: Record<string, string>
): Promise<CustomFieldValidation> {
  if (Object.keys(values).length === 0) return { success: true };
  const { validateCustomFieldValues: validateAction } =
    await customFieldsModule();
  const result = (await validateAction(values)) as {
    ok?: boolean;
    success?: boolean;
    errors?: Record<string, string | string[]>;
  };
  const ok = result.ok ?? result.success ?? true;
  if (ok) return { success: true };
  const errors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(result.errors ?? {})) {
    errors[key] = Array.isArray(value) ? value : [value];
  }
  return { success: false, errors };
}
