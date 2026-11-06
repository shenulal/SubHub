// src/components/approvals/decision/decision-dialog.tsx
"use client";

/**
 * The one decision dialog used by the request detail, the inbox rows, the
 * inbox bulk bar and the dashboard card. Validation runs again on the server;
 * field errors from the action are shown under their inputs.
 */
import { FieldError } from "@/components/common/quick-create/form-bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ApproveFields,
  CommentOnlyFields,
  RejectFields,
} from "./decision-fields";
import {
  firstErrors,
  submitDecision,
  type SubmitOutcome,
} from "./submit-decision";
import {
  emptyDraft,
  type DecisionDraft,
  type DecisionKind,
  type DecisionTarget,
  type FieldErrors,
} from "./types";
import { useDecisionOptions } from "./use-decision-options";

export interface DecisionDialogProps {
  kind: DecisionKind | null;
  target: DecisionTarget | null;
  onClose: () => void;
  /** Called after a successful decision (lists / detail refetch on their own). */
  onDone?: (outcome: SubmitOutcome) => void;
}

const DONE_KEY: Record<DecisionKind, string> = {
  approve: "approved",
  reject: "rejected",
  requestInfo: "infoRequested",
  provideInfo: "infoProvided",
  cancel: "cancelled",
};

function needsComment(kind: DecisionKind, requireApprove: boolean): boolean {
  if (kind === "approve") return requireApprove;
  return kind !== "cancel";
}

function useTitles(kind: DecisionKind | null, target: DecisionTarget | null) {
  const t = useTranslations("approvals.decision");
  const ta = useTranslations("approvals.detail.actions");
  if (!kind || !target) return { title: "", description: "" };
  const count = target.ids.length;
  if (kind === "approve" || kind === "reject") {
    const title =
      count > 1
        ? t(kind === "approve" ? "approveBulkTitle" : "rejectBulkTitle", {
            count,
          })
        : t(kind === "approve" ? "approveTitle" : "rejectTitle", {
            name: target.serviceName,
          });
    const description =
      count > 1
        ? t("bulkHint")
        : t(kind === "approve" ? "approveDescription" : "rejectDescription");
    return { title, description };
  }
  return { title: ta(`${kind}Title`), description: ta(`${kind}Description`) };
}

export function DecisionDialog({
  kind,
  target,
  onClose,
  onDone,
}: DecisionDialogProps) {
  const t = useTranslations("approvals.decision");
  const ta = useTranslations("approvals.detail.actions");
  const tc = useTranslations("approvals.common");
  const queryClient = useQueryClient();
  const open = kind !== null && target !== null;
  const options = useDecisionOptions(
    open && (kind === "approve" || kind === "reject")
  );
  const [draft, setDraft] = useState<DecisionDraft>(() => emptyDraft(target));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();
  const { title, description } = useTitles(kind, target);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft(target));
      setErrors({});
    }
  }, [open, target]);

  const patch = (p: Partial<DecisionDraft>) =>
    setDraft((d) => ({ ...d, ...p }));

  const validate = (): FieldErrors => {
    if (!kind) return {};
    const next: FieldErrors = {};
    const requireApprove = options.data?.requireApproveComment ?? false;
    if (needsComment(kind, requireApprove) && !draft.comment.trim()) {
      next.comment = t("required");
    }
    if (kind === "reject" && !draft.reasonId) next.reasonId = t("required");
    return next;
  };

  const report = (outcome: SubmitOutcome) => {
    if (!kind || !target) return;
    if (target.ids.length > 1) {
      const msg = outcome.failed.length
        ? t("bulkPartial", {
            ok: outcome.succeeded,
            failed: outcome.failed.length,
            reason: outcome.failed[0].error,
          })
        : t("bulkDone", { ok: outcome.succeeded });
      if (outcome.failed.length) toast.warning(msg);
      else toast.success(msg);
      return;
    }
    toast.success(ta(DONE_KEY[kind] as "approved"));
  };

  const confirm = () => {
    if (!kind || !target) return;
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length) return;
    startTransition(async () => {
      const outcome = await submitDecision(kind, target, draft);
      if (!outcome.success) {
        setErrors({
          ...firstErrors(outcome.errors),
          form: outcome.error ?? tc("errorGeneric"),
        });
        toast.error(outcome.error ?? tc("errorGeneric"));
        return;
      }
      report(outcome);
      await queryClient.invalidateQueries({ queryKey: ["approvals"] });
      onDone?.(outcome);
      onClose();
    });
  };

  const fieldProps = { draft, onChange: patch, errors, disabled: isPending };
  const destructive = kind === "reject" || kind === "cancel";
  const needsOptions = kind === "approve" || kind === "reject";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {kind && target && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-6" title={title}>
                {title}
              </DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            {needsOptions && !options.data ? (
              <div className="grid gap-3" aria-busy>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : kind === "approve" && options.data ? (
              <ApproveFields
                {...fieldProps}
                target={target}
                options={options.data}
              />
            ) : kind === "reject" && options.data ? (
              <RejectFields {...fieldProps} options={options.data} />
            ) : (
              <CommentOnlyFields
                {...fieldProps}
                required={needsComment(kind, false)}
                placeholder={ta("comment")}
              />
            )}
            <FieldError message={errors.form} />
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isPending}>
                {tc("cancel")}
              </Button>
              <Button
                onClick={confirm}
                disabled={isPending || (needsOptions && !options.data)}
                variant={destructive ? "destructive" : "default"}
                className={
                  kind === "approve"
                    ? "bg-success hover:bg-success/90 text-white"
                    : undefined
                }
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : kind === "approve" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : kind === "reject" ? (
                  <X className="mr-2 h-4 w-4" />
                ) : null}
                {kind === "approve"
                  ? t("confirmApprove")
                  : kind === "reject"
                    ? t("confirmReject")
                    : ta("confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
