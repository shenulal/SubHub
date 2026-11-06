// src/components/approvals/decision/types.ts
export type DecisionKind =
  | "approve"
  | "reject"
  | "requestInfo"
  | "provideInfo"
  | "cancel";

/** The request(s) a decision applies to. Several ids = bulk approve / reject. */
export interface DecisionTarget {
  ids: string[];
  serviceName: string;
  categoryId: string | null;
  costCenterId: string | null;
}

export interface DecisionDraft {
  comment: string;
  conditions: string;
  costCenterId: string | null;
  categoryId: string | null;
  effectiveStartDate: string;
  reasonId: string | null;
}

export type FieldErrors = Partial<Record<keyof DecisionDraft | "form", string>>;

export function emptyDraft(target: DecisionTarget | null): DecisionDraft {
  return {
    comment: "",
    conditions: "",
    costCenterId: target?.costCenterId ?? null,
    categoryId: target?.categoryId ?? null,
    effectiveStartDate: "",
    reasonId: null,
  };
}

export function targetOf(request: {
  id: string;
  serviceName: string;
  category: { id: string } | null;
  costCenterId?: string | null;
  costCenter?: { id: string } | null;
}): DecisionTarget {
  return {
    ids: [request.id],
    serviceName: request.serviceName,
    categoryId: request.category?.id ?? null,
    costCenterId: request.costCenter?.id ?? request.costCenterId ?? null,
  };
}
