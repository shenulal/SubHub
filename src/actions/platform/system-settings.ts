// src/actions/platform/system-settings.ts
"use server";

import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { withLogging } from "@/lib/logging";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  isSettingKey,
  SETTING_DEFINITIONS,
  SETTING_GROUPS,
  SETTING_KEYS,
  type SettingKey,
} from "@/lib/settings/registry";
import { getSystemSetting, setSystemSetting } from "@/lib/settings/service";
import { settingKeySchema } from "@/lib/validations/platform";
import type { ActionState } from "@/types";
import {
  SECRET_UNCHANGED,
  type SerializedSettingDefinition,
  type SettingsGroupPayload,
} from "@/types/platform";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, diffRecords, toActionError } from "./_shared";
import { loadCurrencyOptions } from "./settings-options";

const SYSTEM_PATH = "/super-admin/settings";
const valuesSchema = z.record(z.string(), z.unknown());

function systemKeys(): SettingKey[] {
  return SETTING_KEYS.filter((k) => SETTING_DEFINITIONS[k].scope === "system");
}

function maskSecret(def: { sensitive?: boolean }, value: unknown): unknown {
  if (!def.sensitive || typeof value !== "string" || !value) return value;
  return value.length > 4 ? `••••${value.slice(-4)}` : "••••";
}

async function _getSystemSettings(): Promise<
  ActionState<SettingsGroupPayload>
> {
  try {
    await requireSuperAdmin();
    const keys = systemKeys();
    const overrides = new Set(
      (
        await prisma.systemSetting.findMany({
          where: { key: { in: keys } },
          select: { key: true },
        })
      ).map((r) => r.key)
    );
    const currencyOptions = await loadCurrencyOptions();
    const definitions: SerializedSettingDefinition[] = [];
    for (const key of keys) {
      const def = SETTING_DEFINITIONS[key];
      const value = await getSystemSetting(key);
      definitions.push({
        key: def.key,
        group: def.group,
        scope: def.scope,
        label: def.label,
        description: def.description,
        input: def.input,
        options:
          key === "system.reportingCurrency" ? currencyOptions : def.options,
        unit: def.unit,
        min: def.min,
        max: def.max,
        sensitive: def.sensitive,
        defaultValue: def.defaultValue,
        value: maskSecret(def, value),
        isOverridden: overrides.has(key),
      });
    }
    return {
      success: true,
      data: { group: "system", ...SETTING_GROUPS.system, definitions },
    };
  } catch (error) {
    return toActionError(error, "getSystemSettings");
  }
}
export const getSystemSettings = withLogging(
  "getSystemSettings",
  _getSystemSettings
);

async function _updateSystemSettings(
  valuesInput: Record<string, unknown>
): Promise<ActionState<{ updatedKeys: string[] }>> {
  try {
    const { userId } = await requireSuperAdmin();
    const values = valuesSchema.parse(valuesInput);
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (!isSettingKey(key) || SETTING_DEFINITIONS[key].scope !== "system") {
        throw new ActionError(`"${key}" is not a platform setting`);
      }
      if (SETTING_DEFINITIONS[key].sensitive && value === SECRET_UNCHANGED)
        continue;
      before[key] = await getSystemSetting(key);
      const result = await setSystemSetting(key, value);
      after[key] = result.value;
    }
    const changes = diffRecords(
      before,
      after,
      new Set(
        Object.keys(after).filter(
          (k) => SETTING_DEFINITIONS[k as SettingKey].sensitive
        )
      )
    );
    logger.info({ userId, changes }, "[platform] system settings updated");
    if (Object.keys(changes).length > 0) {
      await writePlatformAudit({
        actorId: userId,
        action: "UPDATE_PLATFORM_SETTINGS",
        entityType: "SystemSetting",
        changes: changes as Prisma.InputJsonValue,
      });
    }
    revalidatePath(SYSTEM_PATH);
    return { success: true, data: { updatedKeys: Object.keys(changes) } };
  } catch (error) {
    return toActionError(error, "updateSystemSettings");
  }
}
export const updateSystemSettings = withLogging(
  "updateSystemSettings",
  _updateSystemSettings
);

async function _resetSystemSetting(
  keyInput: string
): Promise<ActionState<{ value: unknown }>> {
  try {
    const { userId } = await requireSuperAdmin();
    const key = settingKeySchema.parse(keyInput);
    if (!isSettingKey(key) || SETTING_DEFINITIONS[key].scope !== "system") {
      throw new ActionError(`"${key}" is not a platform setting`);
    }
    await prisma.systemSetting.deleteMany({ where: { key } });
    logger.info({ userId, key }, "[platform] system setting reset");
    await writePlatformAudit({
      actorId: userId,
      action: "RESET_PLATFORM_SETTING",
      entityType: "SystemSetting",
      entityId: key,
    });
    revalidatePath(SYSTEM_PATH);
    return {
      success: true,
      data: { value: SETTING_DEFINITIONS[key].defaultValue },
    };
  } catch (error) {
    return toActionError(error, "resetSystemSetting");
  }
}
export const resetSystemSetting = withLogging(
  "resetSystemSetting",
  _resetSystemSetting
);
