// src/actions/taxonomy/custom-fields.ts
/**
 * Custom field definition actions. The number of active fields is capped by
 * the `subscriptions.maxCustomFields` setting (never hard-coded).
 */
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import { nextUniqueSlug } from "@/lib/services/taxonomy/category-tree";
import { isOptionFieldType } from "@/lib/services/taxonomy/custom-field-options";
import {
  keyFromLabel,
  validateCustomFieldValues as validatePure,
} from "@/lib/services/taxonomy/custom-field-validation";
import { getSetting } from "@/lib/settings/service";
import {
  createCustomFieldSchema,
  updateCustomFieldSchema,
  type CreateCustomFieldInput,
  type UpdateCustomFieldInput,
} from "@/lib/validations/taxonomy";
import type { ActionState } from "@/types";
import type {
  CustomFieldDefinitionDto,
  CustomFieldTypeValue,
  CustomFieldValidationResult,
} from "@/types/taxonomy";

import {
  TAXONOMY_PATHS,
  toActionError,
  validationFailure,
  writeAudit,
} from "./_shared";

const ENTITY = "CustomFieldDefinition";

type DbDef = {
  id: string;
  key: string;
  label: string;
  fieldType: CustomFieldTypeValue;
  options: unknown;
  isRequired: boolean;
  sortOrder: number;
  isArchived: boolean;
  _count?: { values: number };
};

function toDto(d: DbDef): CustomFieldDefinitionDto {
  const options = Array.isArray(d.options)
    ? d.options.filter((o): o is string => typeof o === "string")
    : null;
  return {
    id: d.id,
    key: d.key,
    label: d.label,
    fieldType: d.fieldType,
    options,
    isRequired: d.isRequired,
    sortOrder: d.sortOrder,
    isArchived: d.isArchived,
    usageCount: d._count?.values,
  };
}

function revalidate() {
  revalidatePath(TAXONOMY_PATHS.customFields);
  revalidatePath(TAXONOMY_PATHS.subscriptions);
}

async function loadDefinitions(
  organizationId: string,
  includeArchived: boolean
) {
  const rows = await prisma.customFieldDefinition.findMany({
    where: {
      organizationId,
      ...(includeArchived ? {} : { isArchived: false }),
    },
    include: { _count: { select: { values: true } } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map(toDto);
}

// ─── Reads ───────────────────────────────────────────────────────────

export async function getCustomFieldDefinitions(
  options: { includeArchived?: boolean } = {}
): Promise<CustomFieldDefinitionDto[]> {
  try {
    const { organizationId } = await requirePermission("custom_fields:read");
    return await loadDefinitions(
      organizationId,
      Boolean(options.includeArchived)
    );
  } catch (error) {
    toActionError(error, "getCustomFieldDefinitions");
    return [];
  }
}

/** Server-side validation against the org's active definitions (keyed by field id). */
export async function validateCustomFieldValues(
  values: Record<string, string>
): Promise<CustomFieldValidationResult> {
  const { organizationId } = await requirePermission("custom_fields:read");
  const definitions = await loadDefinitions(organizationId, false);
  return validatePure(definitions, values);
}

// ─── Writes ──────────────────────────────────────────────────────────

async function _createCustomField(
  input: CreateCustomFieldInput
): Promise<ActionState<CustomFieldDefinitionDto>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "custom_fields:manage"
    );
    const parsed = createCustomFieldSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const [maxFields, existing] = await Promise.all([
      getSetting(organizationId, "subscriptions.maxCustomFields"),
      prisma.customFieldDefinition.findMany({
        where: { organizationId },
        select: { key: true, isArchived: true, sortOrder: true },
      }),
    ]);
    const activeCount = existing.filter((e) => !e.isArchived).length;
    if (activeCount >= maxFields) {
      return {
        success: false,
        error: `Limit of ${maxFields} custom fields reached`,
      };
    }
    const key = nextUniqueSlug(
      data.key ?? keyFromLabel(data.label),
      existing.map((e) => e.key)
    );
    const sortOrder =
      existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1;

    const created = await prisma.customFieldDefinition.create({
      data: {
        organizationId,
        key,
        label: data.label,
        fieldType: data.fieldType,
        options: isOptionFieldType(data.fieldType)
          ? (data.options ?? [])
          : undefined,
        isRequired: data.isRequired ?? false,
        sortOrder,
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "CREATE_CUSTOM_FIELD",
      entityType: ENTITY,
      entityId: created.id,
      changes: { key, label: data.label, fieldType: data.fieldType },
    });
    revalidate();
    return {
      success: true,
      data: toDto(created),
      message: "Custom field created",
    };
  } catch (error) {
    return toActionError(error, "createCustomField");
  }
}
export const createCustomField = withLogging(
  "createCustomField",
  _createCustomField
);

async function _updateCustomField(
  id: string,
  input: UpdateCustomFieldInput
): Promise<ActionState<CustomFieldDefinitionDto>> {
  try {
    const { organizationId, userId } = await requirePermission(
      "custom_fields:manage"
    );
    const parsed = updateCustomFieldSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return { success: false, error: "Custom field not found" };
    if (
      isOptionFieldType(existing.fieldType) &&
      data.options !== undefined &&
      (data.options?.length ?? 0) === 0
    ) {
      return {
        success: false,
        error: "Select fields need at least one option",
      };
    }
    const updated = await prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(isOptionFieldType(existing.fieldType) &&
          data.options !== undefined && { options: data.options ?? [] }),
      },
    });
    await writeAudit({
      organizationId,
      userId,
      action: "UPDATE_CUSTOM_FIELD",
      entityType: ENTITY,
      entityId: id,
      changes: { ...data },
    });
    revalidate();
    return {
      success: true,
      data: toDto(updated),
      message: "Custom field updated",
    };
  } catch (error) {
    return toActionError(error, "updateCustomField");
  }
}
export const updateCustomField = withLogging(
  "updateCustomField",
  _updateCustomField
);

async function setArchived(
  id: string,
  isArchived: boolean,
  context: string
): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission(
      "custom_fields:manage"
    );
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id, organizationId },
    });
    if (!existing) return { success: false, error: "Custom field not found" };
    if (!isArchived) {
      const [maxFields, activeCount] = await Promise.all([
        getSetting(organizationId, "subscriptions.maxCustomFields"),
        prisma.customFieldDefinition.count({
          where: { organizationId, isArchived: false },
        }),
      ]);
      if (activeCount >= maxFields)
        return {
          success: false,
          error: `Limit of ${maxFields} custom fields reached`,
        };
    }
    await prisma.customFieldDefinition.update({
      where: { id },
      data: { isArchived },
    });
    await writeAudit({
      organizationId,
      userId,
      action: isArchived ? "ARCHIVE_CUSTOM_FIELD" : "RESTORE_CUSTOM_FIELD",
      entityType: ENTITY,
      entityId: id,
      changes: { key: existing.key },
    });
    revalidate();
    return {
      success: true,
      message: isArchived ? "Custom field archived" : "Custom field restored",
    };
  } catch (error) {
    return toActionError(error, context);
  }
}
export const archiveCustomField = withLogging(
  "archiveCustomField",
  async (id: string) => setArchived(id, true, "archiveCustomField")
);
export const restoreCustomField = withLogging(
  "restoreCustomField",
  async (id: string) => setArchived(id, false, "restoreCustomField")
);

async function _reorderCustomFields(
  orderedIds: string[]
): Promise<ActionState> {
  try {
    const { organizationId, userId } = await requirePermission(
      "custom_fields:manage"
    );
    const owned = await prisma.customFieldDefinition.findMany({
      where: { organizationId, id: { in: orderedIds } },
      select: { id: true },
    });
    if (owned.length !== new Set(orderedIds).size)
      return { success: false, error: "Custom field not found" };
    await prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        prisma.customFieldDefinition.update({
          where: { id },
          data: { sortOrder },
        })
      )
    );
    await writeAudit({
      organizationId,
      userId,
      action: "REORDER_CUSTOM_FIELDS",
      entityType: ENTITY,
      entityId: null,
      changes: { orderedIds },
    });
    revalidate();
    return { success: true, message: "Order saved" };
  } catch (error) {
    return toActionError(error, "reorderCustomFields");
  }
}
export const reorderCustomFields = withLogging(
  "reorderCustomFields",
  _reorderCustomFields
);
