// src/lib/settings/service.ts
/**
 * Settings service — the only way feature code should read tunables.
 *
 * Resolution order for an organisation setting:
 *   organization_settings override → system_settings override → registry default
 *
 * All reads are validated against the registry schema so a bad row never
 * propagates; invalid values fall back to the default and are logged.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import { cache } from "react";
import {
  getDefaultSettings,
  isSettingKey,
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  type ResolvedSettings,
  type SettingKey,
  type SettingScope,
  type SettingValue,
} from "./registry";

type JsonValue = Prisma.InputJsonValue;

function parseOrDefault<K extends SettingKey>(
  key: K,
  raw: unknown,
  source: string
): SettingValue<K> {
  const def = SETTING_DEFINITIONS[key];
  const result = def.schema.safeParse(raw);
  if (result.success) return result.data as SettingValue<K>;
  logger.warn(
    { key, source, issues: result.error.issues },
    "[settings] stored value failed validation, using default"
  );
  return def.defaultValue as SettingValue<K>;
}

const loadSystemOverrides = cache(async (): Promise<Map<string, unknown>> => {
  const rows = await prisma.systemSetting.findMany({
    select: { key: true, value: true },
  });
  return new Map(rows.map((r) => [r.key, r.value as unknown]));
});

const loadOrganizationOverrides = cache(
  async (organizationId: string): Promise<Map<string, unknown>> => {
    const rows = await prisma.organizationSetting.findMany({
      where: { organizationId },
      select: { key: true, value: true },
    });
    return new Map(rows.map((r) => [r.key, r.value as unknown]));
  }
);

/**
 * Resolve every registry key for an organisation.
 */
export async function getOrganizationSettings(
  organizationId: string
): Promise<ResolvedSettings> {
  const [orgOverrides, systemOverrides] = await Promise.all([
    loadOrganizationOverrides(organizationId),
    loadSystemOverrides(),
  ]);
  const resolved = getDefaultSettings() as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    if (orgOverrides.has(key)) {
      resolved[key] = parseOrDefault(
        key,
        orgOverrides.get(key),
        "organization"
      );
    } else if (systemOverrides.has(key)) {
      resolved[key] = parseOrDefault(key, systemOverrides.get(key), "system");
    }
  }
  return resolved as ResolvedSettings;
}

/**
 * Resolve a single organisation setting.
 */
export async function getSetting<K extends SettingKey>(
  organizationId: string,
  key: K
): Promise<SettingValue<K>> {
  const all = await getOrganizationSettings(organizationId);
  return all[key];
}

/**
 * Resolve several keys at once (typed).
 */
export async function getSettings<K extends SettingKey>(
  organizationId: string,
  keys: readonly K[]
): Promise<Pick<ResolvedSettings, K>> {
  const all = await getOrganizationSettings(organizationId);
  const out = {} as Pick<ResolvedSettings, K>;
  for (const k of keys) out[k] = all[k];
  return out;
}

/**
 * Resolve a system-scoped setting (SUPER_ADMIN controlled).
 */
export async function getSystemSetting<K extends SettingKey>(
  key: K
): Promise<SettingValue<K>> {
  const overrides = await loadSystemOverrides();
  if (overrides.has(key))
    return parseOrDefault(key, overrides.get(key), "system");
  return SETTING_DEFINITIONS[key].defaultValue as SettingValue<K>;
}

export interface SetSettingResult<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValue<K>;
}

export class SettingValidationError extends Error {
  constructor(
    public readonly key: string,
    public readonly issues: string[]
  ) {
    super(`Invalid value for setting "${key}": ${issues.join("; ")}`);
    this.name = "SettingValidationError";
  }
}

function validateForWrite<K extends SettingKey>(key: K, value: unknown) {
  const def = SETTING_DEFINITIONS[key];
  const result = def.schema.safeParse(value);
  if (!result.success) {
    throw new SettingValidationError(
      key,
      result.error.issues.map((i) => i.message)
    );
  }
  return result.data as SettingValue<K>;
}

/**
 * Persist an organisation override. Validates against the registry schema.
 */
export async function setOrganizationSetting<K extends SettingKey>(
  organizationId: string,
  key: K,
  value: unknown,
  updatedById?: string | null
): Promise<SetSettingResult<K>> {
  if (!isSettingKey(key))
    throw new SettingValidationError(key, ["Unknown key"]);
  if (SETTING_DEFINITIONS[key].scope !== "organization") {
    throw new SettingValidationError(key, [
      "Not an organisation-scoped setting",
    ]);
  }
  const parsed = validateForWrite(key, value);
  await prisma.organizationSetting.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: {
      organizationId,
      key,
      value: parsed as JsonValue,
      updatedById: updatedById ?? null,
    },
    update: { value: parsed as JsonValue, updatedById: updatedById ?? null },
  });
  return { key, value: parsed };
}

/**
 * Persist several organisation overrides in one transaction.
 */
export async function setOrganizationSettings(
  organizationId: string,
  values: Partial<Record<SettingKey, unknown>>,
  updatedById?: string | null
): Promise<SetSettingResult[]> {
  const entries = Object.entries(values) as [SettingKey, unknown][];
  const prepared = entries.map(([key, value]) => {
    if (!isSettingKey(key))
      throw new SettingValidationError(key, ["Unknown key"]);
    if (SETTING_DEFINITIONS[key].scope !== "organization") {
      throw new SettingValidationError(key, [
        "Not an organisation-scoped setting",
      ]);
    }
    return { key, value: validateForWrite(key, value) };
  });
  await prisma.$transaction(
    prepared.map(({ key, value }) =>
      prisma.organizationSetting.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: {
          organizationId,
          key,
          value: value as JsonValue,
          updatedById: updatedById ?? null,
        },
        update: { value: value as JsonValue, updatedById: updatedById ?? null },
      })
    )
  );
  return prepared;
}

/**
 * Remove an override so the system/default value applies again.
 */
export async function resetOrganizationSetting(
  organizationId: string,
  key: SettingKey
): Promise<void> {
  await prisma.organizationSetting.deleteMany({
    where: { organizationId, key },
  });
}

export async function setSystemSetting<K extends SettingKey>(
  key: K,
  value: unknown
): Promise<SetSettingResult<K>> {
  if (!isSettingKey(key))
    throw new SettingValidationError(key, ["Unknown key"]);
  const parsed = validateForWrite(key, value);
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: parsed as JsonValue },
    update: { value: parsed as JsonValue },
  });
  return { key, value: parsed };
}

/**
 * Mask secrets before sending settings to the browser.
 */
export function maskSensitiveSettings(
  settings: ResolvedSettings
): ResolvedSettings {
  const copy = { ...settings } as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    const def = SETTING_DEFINITIONS[key];
    if (def.sensitive && typeof copy[key] === "string" && copy[key]) {
      const v = copy[key] as string;
      copy[key] = v.length > 4 ? `••••${v.slice(-4)}` : "••••";
    }
  }
  return copy as ResolvedSettings;
}

export function scopeOf(key: SettingKey): SettingScope {
  return SETTING_DEFINITIONS[key].scope;
}
