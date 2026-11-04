// src/lib/fx/providers/exchangerate-host.ts
import {
  fetchJson,
  FxProviderError,
  normalizeCodes,
  type FxProvider,
  type FxProviderOptions,
  type FxQuote,
} from "./types";

const ENDPOINT = "https://api.exchangerate.host/live";
const MS_PER_SECOND = 1000;

interface ExchangerateHostResponse {
  success: boolean;
  timestamp?: number;
  source?: string;
  quotes?: Record<string, number>;
  error?: { code?: number; info?: string };
}

/** exchangerate.host (apilayer) — requires `finance.fxApiKey`. */
export function createExchangerateHostProvider(
  options: FxProviderOptions = {}
): FxProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "exchangerate_host",
    async fetchRates(base, quotes): Promise<FxQuote[]> {
      if (!options.apiKey) {
        throw new FxProviderError(
          "exchangerate_host",
          "API key missing (finance.fxApiKey)"
        );
      }
      const wanted = normalizeCodes(quotes).filter((q) => q !== base);
      if (wanted.length === 0) return [];
      const url =
        `${ENDPOINT}?access_key=${encodeURIComponent(options.apiKey)}` +
        `&source=${encodeURIComponent(base)}&currencies=${wanted.join(",")}`;
      const json = await fetchJson<ExchangerateHostResponse>(
        fetchImpl,
        url,
        "exchangerate_host"
      );
      if (!json.success || !json.quotes) {
        throw new FxProviderError(
          "exchangerate_host",
          json.error?.info ?? "unexpected response"
        );
      }
      const asOf = json.timestamp
        ? new Date(json.timestamp * MS_PER_SECOND)
        : new Date();
      return Object.entries(json.quotes)
        .map(([pair, rate]) => ({ quote: pair.slice(base.length), rate }))
        .filter(({ quote, rate }) => wanted.includes(quote) && rate > 0)
        .map(({ quote, rate }) => ({ quote, rate, asOf }));
    },
  };
}
