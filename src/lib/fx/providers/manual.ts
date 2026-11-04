// src/lib/fx/providers/manual.ts
import type { FxProvider } from "./types";

/** Manual mode: rates are entered by an administrator, nothing is fetched. */
export const manualProvider: FxProvider = {
  id: "manual",
  async fetchRates() {
    return [];
  },
};
