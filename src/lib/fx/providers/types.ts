// src/lib/fx/providers/types.ts

export type FxProviderId =
  | "manual"
  | "frankfurter"
  | "open_er_api"
  | "exchangerate_host"
  | "google_finance";

export interface FxQuote {
  quote: string;
  rate: number;
  asOf: Date;
}

export interface FxProvider {
  id: FxProviderId;
  /** Fetch `base → quote` rates for the requested quote currencies. */
  fetchRates(base: string, quotes: string[]): Promise<FxQuote[]>;
}

export interface FxProviderOptions {
  apiKey?: string;
  /** Overridable for tests */
  fetchImpl?: typeof fetch;
}

export const FX_FETCH_TIMEOUT_MS = 10_000;

export class FxProviderError extends Error {
  constructor(
    public readonly providerId: FxProviderId,
    message: string
  ) {
    super(`[fx:${providerId}] ${message}`);
    this.name = "FxProviderError";
  }
}

export function normalizeCodes(codes: string[]): string[] {
  return Array.from(
    new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))
  );
}

export async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  providerId: FxProviderId
): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FX_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new FxProviderError(providerId, `HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}
