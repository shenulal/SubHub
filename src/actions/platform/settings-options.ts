// src/actions/platform/settings-options.ts
/**
 * Dynamic option lists for select-type settings whose choices live in master
 * data rather than the registry (currencies, countries, roles).
 */
import { prisma } from "@/lib/db";
import type { SettingOption } from "@/lib/settings/registry";

const CURRENCY_KEYS = new Set([
  "finance.baseCurrency",
  "finance.enabledCurrencies",
  "system.reportingCurrency",
]);
const COUNTRY_KEYS = new Set(["general.countryCode"]);
const ROLE_KEYS = new Set([
  "security.defaultRoleKey",
  "approvals.escalateToRole",
]);

export async function loadCurrencyOptions(): Promise<SettingOption[]> {
  const rows = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { code: true, name: true, symbol: true },
  });
  return rows.map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.name} (${c.symbol})`,
  }));
}

export async function loadCountryOptions(): Promise<SettingOption[]> {
  const rows = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { code: true, name: true },
  });
  return rows.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }));
}

export async function loadRoleOptions(
  organizationId: string
): Promise<SettingOption[]> {
  const rows = await prisma.role.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { key: true, name: true, isSystem: true },
  });
  return rows.map((r) => ({
    value: r.key,
    label: r.isSystem ? r.name : `${r.name} (custom)`,
  }));
}

/** Options keyed by setting key, only for the keys that need them. */
export async function resolveDynamicOptions(
  organizationId: string,
  keys: readonly string[]
): Promise<Record<string, SettingOption[]>> {
  const out: Record<string, SettingOption[]> = {};
  const needCurrency = keys.some((k) => CURRENCY_KEYS.has(k));
  const needCountry = keys.some((k) => COUNTRY_KEYS.has(k));
  const needRole = keys.some((k) => ROLE_KEYS.has(k));
  const [currencies, countries, roles] = await Promise.all([
    needCurrency ? loadCurrencyOptions() : Promise.resolve([]),
    needCountry ? loadCountryOptions() : Promise.resolve([]),
    needRole ? loadRoleOptions(organizationId) : Promise.resolve([]),
  ]);
  for (const key of keys) {
    if (CURRENCY_KEYS.has(key)) out[key] = currencies;
    else if (COUNTRY_KEYS.has(key)) out[key] = countries;
    else if (ROLE_KEYS.has(key) && roles.length > 0) out[key] = roles;
  }
  return out;
}
