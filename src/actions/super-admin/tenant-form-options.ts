// src/actions/super-admin/tenant-form-options.ts
"use server";

/**
 * Options for the Control Panel "Create tenant" form: active countries and
 * currencies from the platform masters, IANA time zones, and the platform
 * defaults (settings registry: AE / AED / Asia/Dubai unless changed).
 */
import { prisma } from "@/lib/db";
import { getSystemSetting } from "@/lib/settings/service";
import type { ActionState } from "@/types";
import { platformAction } from "./_action";

export interface TenantFormOptions {
  countries: { value: string; label: string; currency: string | null }[];
  currencies: { value: string; label: string }[];
  timezones: string[];
  defaults: { countryCode: string; baseCurrency: string; timezone: string };
}

function timeZones(fallback: string): string[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  return zones.includes(fallback) ? zones : [fallback, ...zones];
}

async function _getTenantFormOptions(): Promise<
  ActionState<TenantFormOptions>
> {
  const [countries, currencies, countryCode, baseCurrency, timezone] =
    await Promise.all([
      prisma.country.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { code: true, name: true, currencyCode: true },
      }),
      prisma.currency.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: { code: true, name: true },
      }),
      getSystemSetting("general.countryCode"),
      getSystemSetting("finance.baseCurrency"),
      getSystemSetting("general.timezone"),
    ]);
  return {
    success: true,
    data: {
      countries: countries.map((c) => ({
        value: c.code,
        label: `${c.name} (${c.code})`,
        currency: c.currencyCode,
      })),
      currencies: currencies.map((c) => ({
        value: c.code,
        label: `${c.code} — ${c.name}`,
      })),
      timezones: timeZones(timezone),
      defaults: { countryCode, baseCurrency, timezone },
    },
  };
}

export const getTenantFormOptions = platformAction(
  "getTenantFormOptions",
  _getTenantFormOptions
);
