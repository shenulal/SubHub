// src/lib/fx/providers/open-er-api.ts
import {
  fetchJson,
  FxProviderError,
  normalizeCodes,
  type FxProvider,
  type FxProviderOptions,
  type FxQuote,
} from "./types";

const ENDPOINT = "https://open.er-api.com/v6/latest";
const MS_PER_SECOND = 1000;

interface OpenErApiResponse {
  result: "success" | "error";
  time_last_update_unix?: number;
  rates?: Record<string, number>;
  "error-type"?: string;
}

/** open.er-api.com — free, no key, ~160 currencies, daily refresh. */
export function createOpenErApiProvider(
  options: FxProviderOptions = {}
): FxProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: "open_er_api",
    async fetchRates(base, quotes): Promise<FxQuote[]> {
      const wanted = new Set(normalizeCodes(quotes).filter((q) => q !== base));
      if (wanted.size === 0) return [];
      const json = await fetchJson<OpenErApiResponse>(
        fetchImpl,
        `${ENDPOINT}/${encodeURIComponent(base)}`,
        "open_er_api"
      );
      if (json.result !== "success" || !json.rates) {
        throw new FxProviderError(
          "open_er_api",
          json["error-type"] ?? "unexpected response"
        );
      }
      const asOf = json.time_last_update_unix
        ? new Date(json.time_last_update_unix * MS_PER_SECOND)
        : new Date();
      return Object.entries(json.rates)
        .filter(([code, rate]) => wanted.has(code) && rate > 0)
        .map(([quote, rate]) => ({ quote, rate, asOf }));
    },
  };
}
