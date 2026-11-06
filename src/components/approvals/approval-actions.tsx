// src/components/approvals/approval-actions.tsx
"use client";

/**
 * Feature 2.4 — decision buttons on the request detail page. The dialog is the
 * shared `DecisionDialog` (also used by the inbox and the dashboard card).
 */
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import type { ApprovalRequestDetail } from "@/types/approval";
import { Check, CircleSlash, HelpCircle, Reply, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DecisionDialog } from "./decision/decision-dialog";
import {
  targetOf,
  type DecisionKind,
  type DecisionTarget,
} from "./decision/types";

interface Props {
  request: ApprovalRequestDetail;
  onChanged: () => void;
}

export function ApprovalActions({ request, onChanged }: Props) {
  const t = useTranslations("approvals.detail.actions");
  const [kind, setKind] = useState<DecisionKind | null>(null);
  const [target, setTarget] = useState<DecisionTarget | null>(null);
  const { viewer } = request;

  const open = (next: DecisionKind) => {
    setTarget(targetOf(request));
    setKind(next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {viewer.canDecide && (
          <Can permission="approvals:decide">
            <Button
              onClick={() => open("approve")}
              className="bg-success hover:bg-success/90 shrink-0 text-white"
            >
              <Check className="mr-2 h-4 w-4" />
              {t("approve")}
            </Button>
            <Button variant="destructive" onClick={() => open("reject")}>
              <X className="mr-2 h-4 w-4" />
              {t("reject")}
            </Button>
            <Button variant="outline" onClick={() => open("requestInfo")}>
              <HelpCircle className="mr-2 h-4 w-4" />
              {t("requestInfo")}
            </Button>
          </Can>
        )}
        {viewer.canProvideInfo && (
          <Button onClick={() => open("provideInfo")}>
            <Reply className="mr-2 h-4 w-4" />
            {t("provideInfo")}
          </Button>
        )}
        {viewer.canCancel && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => open("cancel")}
          >
            <CircleSlash className="mr-2 h-4 w-4" />
            {t("cancel")}
          </Button>
        )}
      </div>
      <DecisionDialog
        kind={kind}
        target={target}
        onClose={() => setKind(null)}
        onDone={onChanged}
      />
    </>
  );
}
