// src/actions/platform/settings.ts
"use server";

import { prisma } from "@/lib/db";
import { withLogging } from "@/lib/logging";
import { requirePermission } from "@/lib/rbac/service";
import {
  isSettingKey,
  listSettingsByGroup,
  SETTING_DEFINITIONS,
  SETTING_GROUPS,
  type SettingDefinition,
  type SettingGroupKey,
  type SettingKey,
} from "@/lib/settings/registry";
import {
  getOrganizationSettings,
  maskSensitiveSettings,
  resetOrganizationSetting,
  setOrganizationSettings,
} from "@/lib/settings/service";
import {
  settingGroupKeySchema,
  settingKeySchema,
  workspaceSettingsUpdateSchema,
} from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import {
  SECRET_UNCHANGED,
  type SerializedSettingDefinition,
  type SettingsGroupMeta,
  type SettingsGroupPayload,
} from "@/types/platform";
import { revalidatePath } from "next/cache";
import { ActionError, diffRecords, toActionError, writeAudit } from "./_shared";
import { resolveDynamicOptions } from "./settings-options";

const WORKSPACE_PATH = "/settings/workspace";

function assertWorkspaceGroup(group: SettingGroupKey): void {
  if (group === "system") {
    throw new ActionError(
      "Platform settings are managed by the super administrator"
    );
  }
}

function organizationDefinitions(group: SettingGroupKey): SettingDefinition[] {
  return listSettingsByGroup(group).filter((d) => d.scope === "organization");
}

export async function listWorkspaceSettingGroups(): Promise<
  SettingsGroupMeta[]
> {
  return (Object.keys(SETTING_GROUPS) as SettingGroupKey[])
    .filter((key) => key !== "system")
    .map((key) => ({ key, ...SETTING_GROUPS[key] }));
}

async function _getWorkspaceSettings(
  groupInput: string
): Promise<ActionState<SettingsGroupPayload>> {
  try {
    const { organizationId } = await requirePermission("settings:read");
    const group = settingGroupKeySchema.parse(groupInput);
    assertWorkspaceGroup(group);
    const definitions = organizationDefinitions(group);
    const keys = definitions.map((d) => d.key);
    const [resolved, overrides, dynamicOptions] = await Promise.all([
      getOrganizationSettings(organizationId),
      prisma.organizationSetting.findMany({
        where: { organizationId, key: { in: keys } },
        select: { key: true },
      }),
      resolveDynamicOptions(organizationId, keys),
    ]);
    const masked = maskSensitiveSettings(resolved) as Record<string, unknown>;
    const overridden = new Set(overrides.map((o) => o.key));
    const serialized: SerializedSettingDefinition[] = definitions.map((d) => ({
      key: d.key,
      group: d.group,
      scope: d.scope,
      label: d.label,
      description: d.description,
      input: d.input,
      options: dynamicOptions[d.key] ?? d.options,
      unit: d.unit,
      min: d.min,
      max: d.max,
      sensitive: d.sensitive,
      defaultValue: d.defaultValue,
      value: masked[d.key],
      isOverridden: overridden.has(d.key),
    }));
    return {
      success: true,
      data: { group, ...SETTING_GROUPS[group], definitions: serialized },
    };
  } catch (error) {
    return toActionError(error, "getWorkspaceSettings");
  }
}
export const getWorkspaceSettings = withLogging(
  "getWorkspaceSettings",
  _getWorkspaceSettings
);

function pickWritableValues(
  group: SettingGroupKey,
  values: Record<string, unknown>
): Partial<Record<SettingKey, unknown>> {
  const out: Partial<Record<SettingKey, unknown>> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isSettingKey(key)) throw new ActionError(`Unknown setting "${key}"`);
    const def = SETTING_DEFINITIONS[key];
    if (def.group !== group || def.scope !== "organization") {
      throw new ActionError(`Setting "${key}" does not belong to this group`);
    }
    if (def.sensitive && value === SECRET_UNCHANGED) continue;
    out[key] = value;
  }
  return out;
}

async function _updateWorkspaceSettings(
  groupInput: string,
  valuesInput: Record<string, unknown>
): Promise<ActionState<{ updatedKeys: string[] }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("settings:manage");
    const { group, values } = workspaceSettingsUpdateSchema.parse({
      group: groupInput,
      values: valuesInput,
    });
    assertWorkspaceGroup(group);
    const writable = pickWritableValues(group, values);
    const keys = Object.keys(writable) as SettingKey[];
    if (keys.length === 0) return { success: true, data: { updatedKeys: [] } };

    const before = (await getOrganizationSettings(organizationId)) as Record<
      string,
      unknown
    >;
    const results = await setOrganizationSettings(
      organizationId,
      writable,
      userId
    );
    const after = Object.fromEntries(results.map((r) => [r.key, r.value]));
    const sensitive = new Set(
      keys.filter((k) => SETTING_DEFINITIONS[k].sensitive)
    );
    const changes = diffRecords(
      Object.fromEntries(keys.map((k) => [k, before[k]])),
      after,
      sensitive
    );
    if (Object.keys(changes).length > 0) {
      await writeAudit({
        organizationId,
        userId,
        action: "UPDATE_SETTINGS",
        entityType: "OrganizationSetting",
        entityId: group,
        changes: changes as never,
        metadata: { group, keys: Object.keys(changes) },
      });
    }
    revalidatePath(`${WORKSPACE_PATH}/${group}`);
    revalidatePath("/settings");
    return { success: true, data: { updatedKeys: Object.keys(changes) } };
  } catch (error) {
    return toActionError(error, "updateWorkspaceSettings");
  }
}
export const updateWorkspaceSettings = withLogging(
  "updateWorkspaceSettings",
  _updateWorkspaceSettings
);

async function _resetWorkspaceSetting(
  keyInput: string
): Promise<ActionState<{ value: unknown }>> {
  try {
    const { organizationId, userId } =
      await requirePermission("settings:manage");
    const key = settingKeySchema.parse(keyInput);
    if (!isSettingKey(key)) throw new ActionError(`Unknown setting "${key}"`);
    const def = SETTING_DEFINITIONS[key];
    assertWorkspaceGroup(def.group);
    const before = (await getOrganizationSettings(organizationId)) as Record<
      string,
      unknown
    >;
    await resetOrganizationSetting(organizationId, key);
    const after = (await getOrganizationSettings(organizationId)) as Record<
      string,
      unknown
    >;
    await writeAudit({
      organizationId,
      userId,
      action: "RESET_SETTING",
      entityType: "OrganizationSetting",
      entityId: key,
      changes: diffRecords(
        { [key]: before[key] },
        { [key]: after[key] },
        new Set(def.sensitive ? [key] : [])
      ) as never,
    });
    revalidatePath(`${WORKSPACE_PATH}/${def.group}`);
    const value = def.sensitive
      ? (maskSensitiveSettings(after as never) as Record<string, unknown>)[key]
      : after[key];
    return { success: true, data: { value } };
  } catch (error) {
    return toActionError(error, "resetWorkspaceSetting");
  }
}
export const resetWorkspaceSetting = withLogging(
  "resetWorkspaceSetting",
  _resetWorkspaceSetting
);
