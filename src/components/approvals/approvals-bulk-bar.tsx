// src/components/approvals/approvals-bulk-bar.tsx
"use client";

/**
 * Sticky bar for the inbox selection: approve or reject every selected request
 * the viewer can decide (the server validates each one again).
 */
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DecisionKind } from "./decision/types";

interface ApprovalsBulkBarProps {
  count: number;
  onDecide: (kind: Extract<DecisionKind, "approve" | "reject">) => void;
  onClear: () => void;
}

export function ApprovalsBulkBar({
  count,
  onDecide,
  onClear,
}: ApprovalsBulkBarProps) {
  const t = useTranslations("approvals.decision");
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label={t("bulkRegion")}
      data-testid="approvals-bulk-bar"
      className="bg-card/95 border-primary/30 ring-primary/10 sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-lg ring-1 backdrop-blur"
    >
      <span className="bg-primary text-primary-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold">
        {count}
      </span>
      <span className="mr-auto text-sm">{t("selected", { count })}</span>
      <Button
        size="sm"
        className="bg-success hover:bg-success/90 h-8 text-white"
        onClick={() => onDecide("approve")}
      >
        <Check className="mr-1 size-4" />
        {t("bulkApprove")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive h-8"
        onClick={() => onDecide("reject")}
      >
        <X className="mr-1 size-4" />
        {t("bulkReject")}
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={onClear}>
        {t("clearSelection")}
      </Button>
    </div>
  );
}
