// src/components/approvals/approval-actions.tsx
"use client";

/**
 * Feature 2.4 — decision buttons + confirmation dialogs for the detail page.
 */
import {
  approveRequest,
  cancelRequest,
  provideInfo,
  rejectRequest,
  requestInfo,
} from "@/actions/approvals/decisions";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalRequestDetail } from "@/types/approval";
import {
  Check,
  CircleSlash,
  HelpCircle,
  Loader2,
  Reply,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type Kind = "approve" | "reject" | "requestInfo" | "provideInfo" | "cancel";

const REQUIRES_COMMENT: Record<Kind, boolean> = {
  approve: false,
  reject: true,
  requestInfo: true,
  provideInfo: true,
  cancel: false,
};

interface Props {
  request: ApprovalRequestDetail;
  onChanged: () => void;
}

export function ApprovalActions({ request, onChanged }: Props) {
  const t = useTranslations("approvals.detail.actions");
  const tc = useTranslations("approvals.common");
  const [kind, setKind] = useState<Kind | null>(null);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();
  const { viewer } = request;

  const open = (next: Kind) => {
    setComment("");
    setKind(next);
  };

  const run = () => {
    if (!kind) return;
    const id = request.id;
    startTransition(async () => {
      const res =
        kind === "approve"
          ? await approveRequest(id, comment || null)
          : kind === "reject"
            ? await rejectRequest(id, comment)
            : kind === "requestInfo"
              ? await requestInfo(id, comment)
              : kind === "provideInfo"
                ? await provideInfo(id, comment)
                : await cancelRequest(id, comment || null);
      if (!res.success) {
        toast.error(res.error ?? tc("errorGeneric"));
        return;
      }
      const doneKey = {
        approve: "approved",
        reject: "rejected",
        requestInfo: "infoRequested",
        provideInfo: "infoProvided",
        cancel: "cancelled",
      }[kind] as
        | "approved"
        | "rejected"
        | "infoRequested"
        | "infoProvided"
        | "cancelled";
      toast.success(t(doneKey));
      setKind(null);
      onChanged();
    });
  };

  const canConfirm = kind
    ? !REQUIRES_COMMENT[kind] || comment.trim().length > 0
    : false;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {viewer.canDecide && (
          <Can permission="approvals:decide">
            <Button
              onClick={() => open("approve")}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
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

      <Dialog
        open={kind !== null}
        onOpenChange={(o) => !o && !isPending && setKind(null)}
      >
        <DialogContent>
          {kind && (
            <>
              <DialogHeader>
                <DialogTitle>{t(`${kind}Title`)}</DialogTitle>
                <DialogDescription>{t(`${kind}Description`)}</DialogDescription>
              </DialogHeader>
              <Textarea
                autoFocus
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("comment")}
                aria-label={t("comment")}
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setKind(null)}
                  disabled={isPending}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  onClick={run}
                  disabled={isPending || !canConfirm}
                  variant={
                    kind === "reject" || kind === "cancel"
                      ? "destructive"
                      : "default"
                  }
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
