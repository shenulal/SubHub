// src/lib/fx/refresh.ts
/**
 * Pull daily rates from the configured provider and upsert `exchange_rates`.
 * Base is always the pivot currency (USD); `getRate` inverts / triangulates.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getSettings, getSystemSetting } from "@/lib/settings/service";
import {
  FALLBACK_PROVIDER_ID,
  getFxProvider,
  type FxProviderId,
  type FxQuote,
} from "./providers";
import { invalidateRateCache, PIVOT_CURRENCY } from "./rates";

export const RATE_SOURCE_API = "api";
export const RATE_SOURCE_MANUAL = "manual";

export interface RefreshResult {
  provider: FxProviderId;
  base: string;
  requested: string[];
  upserted: number;
  missing: string[];
  asOf: Date | null;
}

/** Truncate to UTC midnight so one row per (pair, day) is kept. */
export function truncateToDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

async function resolveProviderId(
  organizationId?: string
): Promise<FxProviderId> {
  if (organizationId) {
    const override = await prisma.organizationSetting.findUnique({
      where: {
        organizationId_key: { organizationId, key: "finance.fxProvider" },
      },
      select: { value: true },
    });
    if (override) {
      const { "finance.fxProvider": id } = await getSettings(organizationId, [
        "finance.fxProvider",
      ]);
      return id;
    }
  }
  return getSystemSetting("system.defaultFxProvider");
}

async function resolveApiKey(
  organizationId?: string
): Promise<string | undefined> {
  if (organizationId) {
    const { "finance.fxApiKey": key } = await getSettings(organizationId, [
      "finance.fxApiKey",
    ]);
    if (key) return key;
  }
  return process.env.FX_API_KEY || undefined;
}

/** Union of enabled + base currencies for one or every organisation. */
export async function collectQuoteCurrencies(
  organizationId?: string
): Promise<string[]> {
  const orgs = organizationId
    ? [{ id: organizationId }]
    : await prisma.organization.findMany({ select: { id: true } });
  const codes = new Set<string>();
  for (const org of orgs) {
    const s = await getSettings(org.id, [
      "finance.baseCurrency",
      "finance.enabledCurrencies",
    ]);
    codes.add(s["finance.baseCurrency"]);
    s["finance.enabledCurrencies"].forEach((c) => codes.add(c));
  }
  codes.delete(PIVOT_CURRENCY);
  return Array.from(codes).sort();
}

export async function upsertRates(
  base: string,
  quotes: FxQuote[],
  source: string,
  provider: string | null
): Promise<number> {
  let count = 0;
  for (const q of quotes) {
    const asOf = truncateToDay(q.asOf);
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency_asOf: {
          baseCurrency: base,
          quoteCurrency: q.quote,
          asOf,
        },
      },
      create: {
        baseCurrency: base,
        quoteCurrency: q.quote,
        rate: q.rate,
        asOf,
        source,
        provider,
      },
      update: { rate: q.rate, source, provider },
    });
    count++;
  }
  invalidateRateCache();
  return count;
}

export async function refreshExchangeRates(
  organizationId?: string
): Promise<RefreshResult> {
  const [providerId, apiKey, requested] = await Promise.all([
    resolveProviderId(organizationId),
    resolveApiKey(organizationId),
    collectQuoteCurrencies(organizationId),
  ]);
  const base = PIVOT_CURRENCY;
  if (providerId === "manual" || requested.length === 0) {
    return {
      provider: providerId,
      base,
      requested,
      upserted: 0,
      missing: requested,
      asOf: null,
    };
  }

  const provider = getFxProvider(providerId, { apiKey });
  let quotes: FxQuote[] = [];
  try {
    quotes = await provider.fetchRates(base, requested);
  } catch (error) {
    logger.error({ err: error, providerId }, "[fx] provider fetch failed");
  }

  let missing = requested.filter((c) => !quotes.some((q) => q.quote === c));
  if (missing.length > 0 && providerId !== FALLBACK_PROVIDER_ID) {
    try {
      const fallback = await getFxProvider(FALLBACK_PROVIDER_ID).fetchRates(
        base,
        missing
      );
      quotes = [...quotes, ...fallback];
      missing = requested.filter((c) => !quotes.some((q) => q.quote === c));
      logger.info(
        { providerId, filled: fallback.length },
        "[fx] gaps filled by fallback provider"
      );
    } catch (error) {
      logger.warn({ err: error }, "[fx] fallback provider failed");
    }
  }

  const upserted = await upsertRates(base, quotes, RATE_SOURCE_API, providerId);
  const asOf = quotes.length
    ? truncateToDay(
        quotes.reduce(
          (latest, q) => (q.asOf > latest ? q.asOf : latest),
          quotes[0].asOf
        )
      )
    : null;
  logger.info(
    { providerId, upserted, missing },
    "[fx] exchange rates refreshed"
  );
  return { provider: providerId, base, requested, upserted, missing, asOf };
}

export interface ManualRateInput {
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  asOf?: Date;
}

/** Administrator-entered rate (also used when provider is `manual`). */
export async function setManualRate(input: ManualRateInput): Promise<void> {
  const base = input.baseCurrency.toUpperCase();
  const quote = input.quoteCurrency.toUpperCase();
  if (base === quote) throw new Error("Base and quote currency must differ");
  if (!Number.isFinite(input.rate) || input.rate <= 0) {
    throw new Error("Rate must be a positive number");
  }
  await upsertRates(
    base,
    [{ quote, rate: input.rate, asOf: input.asOf ?? new Date() }],
    RATE_SOURCE_MANUAL,
    null
  );
}
