// src/actions/platform/masters/queries.ts
/**
 * Read-side helpers shared by the masters server actions and the
 * `/api/v1/masters/*` REST endpoints. Not a server-action module.
 */
import { decimalToNumber, toIso } from "@/actions/platform/_shared";
import { prisma } from "@/lib/db";
import { getRate } from "@/lib/fx/rates";
import { ensureBillingCycleConfigs } from "@/lib/masters/organization-defaults";
import { getSettings, getSystemSetting } from "@/lib/settings/service";
import type {
  BillingCycleRow,
  CostCenterRow,
  CountryRow,
  CurrencyRow,
  PaymentMethodRow,
  TaxRateRow,
} from "@/types/platform";

const CURRENCY_SETTING_KEYS = [
  "finance.baseCurrency",
  "finance.enabledCurrencies",
  "finance.fxStaleAfterDays",
] as const;

/** Organisation values, or the platform (system) defaults when there is none. */
async function currencySettings(organizationId: string | null) {
  if (organizationId) return getSettings(organizationId, CURRENCY_SETTING_KEYS);
  const [base, enabled, stale] = await Promise.all(
    CURRENCY_SETTING_KEYS.map((k) => getSystemSetting(k))
  );
  return {
    "finance.baseCurrency": base as string,
    "finance.enabledCurrencies": enabled as string[],
    "finance.fxStaleAfterDays": stale as number,
  };
}

/**
 * @param organizationId null = platform view (super-admin console): base and
 *   enabled currencies come from the system defaults.
 */
export async function queryCurrencies(
  organizationId: string | null,
  options: { includeInactive?: boolean } = {}
): Promise<CurrencyRow[]> {
  const [currencies, settings] = await Promise.all([
    prisma.currency.findMany({
      where: options.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
    currencySettings(organizationId),
  ]);
  const base = settings["finance.baseCurrency"];
  const enabled = new Set(settings["finance.enabledCurrencies"]);
  const staleAfterDays = settings["finance.fxStaleAfterDays"];
  return Promise.all(
    currencies.map(async (c) => {
      const isBase = c.code === base;
      const rate = isBase
        ? null
        : await getRate(base, c.code, { staleAfterDays });
      return {
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        decimalDigits: c.decimalDigits,
        isEnabled: isBase || enabled.has(c.code),
        isBase,
        rate: rate && rate.source !== "none" ? rate.rate : null,
        rateAsOf: toIso(rate?.asOf ?? null),
        rateSource: rate && rate.source !== "none" ? rate.source : null,
        stale: rate ? rate.stale : false,
        isActive: c.isActive,
        numericCode: c.numericCode,
        sortOrder: c.sortOrder,
      };
    })
  );
}

export async function queryCountries(
  options: { includeInactive?: boolean } = {}
): Promise<CountryRow[]> {
  const rows = await prisma.country.findMany({
    where: options.includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({
    code: c.code,
    name: c.name,
    region: c.region,
    currencyCode: c.currencyCode,
    defaultTaxRatePercent: decimalToNumber(c.defaultTaxRatePercent),
    phonePrefix: c.phonePrefix,
    isActive: c.isActive,
  }));
}

export async function queryTaxRates(
  organizationId: string
): Promise<TaxRateRow[]> {
  const rows = await prisma.taxRate.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    countryCode: r.countryCode,
    ratePercent: decimalToNumber(r.ratePercent) ?? 0,
    isDefault: r.isDefault,
    isActive: r.isActive,
    validFrom: toIso(r.validFrom),
    validTo: toIso(r.validTo),
  }));
}

export async function queryCostCenters(
  organizationId: string
): Promise<CostCenterRow[]> {
  const rows = await prisma.costCenter.findMany({
    where: { organizationId },
    orderBy: { code: "asc" },
    include: { owner: { select: { name: true, email: true } } },
  });
  const teamIds = rows
    .map((r) => r.teamId)
    .filter((id): id is string => Boolean(id));
  const teams = teamIds.length
    ? await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, name: true },
      })
    : [];
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    ownerId: r.ownerId,
    ownerName: r.owner?.name ?? r.owner?.email ?? null,
    teamId: r.teamId,
    teamName: r.teamId ? (teamName.get(r.teamId) ?? null) : null,
    budgetMonthly: decimalToNumber(r.budgetMonthly),
    budgetCurrency: r.budgetCurrency,
    isActive: r.isActive,
  }));
}

export async function queryPaymentMethods(
  organizationId: string
): Promise<PaymentMethodRow[]> {
  const rows = await prisma.paymentMethodOption.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const cardIds = rows
    .map((r) => r.corporateCardId)
    .filter((id): id is string => Boolean(id));
  const cards = cardIds.length
    ? await prisma.corporateCard.findMany({
        where: { id: { in: cardIds }, organizationId },
        select: { id: true, cardNm: true, cardLast4: true },
      })
    : [];
  const cardLabel = new Map(
    cards.map((c) => [
      c.id,
      [c.cardNm, c.cardLast4 ? `•••• ${c.cardLast4}` : null]
        .filter(Boolean)
        .join(" "),
    ])
  );
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    kind: r.kind,
    corporateCardId: r.corporateCardId,
    corporateCardLabel: r.corporateCardId
      ? (cardLabel.get(r.corporateCardId) ?? null)
      : null,
    isActive: r.isActive,
    isDefault: r.isDefault,
    sortOrder: r.sortOrder,
  }));
}

export async function queryBillingCycles(
  organizationId: string
): Promise<BillingCycleRow[]> {
  await ensureBillingCycleConfigs(organizationId);
  const rows = await prisma.billingCycleConfig.findMany({
    where: { organizationId },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    cycle: r.cycle,
    label: r.label,
    months: r.months,
    isEnabled: r.isEnabled,
    sortOrder: r.sortOrder,
  }));
}
