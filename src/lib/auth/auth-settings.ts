// src/lib/auth/auth-settings.ts
/**
 * Security settings for an account. Tenant users read their organisation's
 * values; platform administrators (no organisation) read the system values.
 */
import type { ResolvedSettings, SettingKey } from "@/lib/settings/registry";
import { getSettings, getSystemSetting } from "@/lib/settings/service";

export async function getAuthSettings<K extends SettingKey>(
  organizationId: string | null,
  keys: readonly K[]
): Promise<Pick<ResolvedSettings, K>> {
  if (organizationId) return getSettings(organizationId, keys);
  const values = await Promise.all(keys.map((k) => getSystemSetting(k)));
  const out = {} as Pick<ResolvedSettings, K>;
  keys.forEach((k, i) => {
    out[k] = values[i] as ResolvedSettings[K];
  });
  return out;
}
