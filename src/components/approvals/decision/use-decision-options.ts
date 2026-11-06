// src/components/approvals/decision/use-decision-options.ts
"use client";

import { getDecisionFormOptions } from "@/actions/approvals/decision-options";
import type { DecisionFormOptions } from "@/types/approval";
import { useQuery } from "@tanstack/react-query";

export const DECISION_OPTIONS_KEY = ["approvals", "decision-options"] as const;

/** Pick lists for the decision dialog; fetched once the dialog opens. */
export function useDecisionOptions(enabled: boolean) {
  return useQuery<DecisionFormOptions>({
    queryKey: DECISION_OPTIONS_KEY,
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await getDecisionFormOptions();
      if (!res.success || !res.data) throw new Error(res.error ?? "failed");
      return res.data;
    },
  });
}
