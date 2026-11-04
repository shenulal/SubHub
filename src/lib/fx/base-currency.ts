// src/lib/fx/base-currency.ts
/**
 * Organisation currency/locale context. Server-only (reads settings).
 */
import { getSettings } from "@/lib/settings/service";

export interface OrganizationCurrencyContext {
  baseCurrency: string;
  enabledCurrencies: string[];
  locale: string;
  timezone: string;
  dateFormat: string;
  roundingDecimals: number;
}

export async function getBaseCurrency(organizationId: string): Promise<string> {
  const { "finance.baseCurrency": base } = await getSettings(organizationId, [
    "finance.baseCurrency",
  ]);
  return base;
}

export async function getCurrencyContext(
  organizationId: string
): Promise<OrganizationCurrencyContext> {
  const s = await getSettings(organizationId, [
    "finance.baseCurrency",
    "finance.enabledCurrencies",
    "finance.roundingDecimals",
    "general.locale",
    "general.timezone",
    "general.dateFormat",
  ]);
  const enabled = s["finance.enabledCurrencies"].includes(
    s["finance.baseCurrency"]
  )
    ? s["finance.enabledCurrencies"]
    : [s["finance.baseCurrency"], ...s["finance.enabledCurrencies"]];
  return {
    baseCurrency: s["finance.baseCurrency"],
    enabledCurrencies: enabled,
    locale: s["general.locale"],
    timezone: s["general.timezone"],
    dateFormat: s["general.dateFormat"],
    roundingDecimals: s["finance.roundingDecimals"],
  };
}
