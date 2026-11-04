// src/components/approvals/policy-manager.tsx
"use client";

/**
 * Feature 2.2 — ordered policy list with activate / reorder / edit / delete.
 */
import {
  deleteApprovalPolicy,
  reorderApprovalPolicies,
  setPolicyActive,
} from "@/actions/approvals/policies";
import { Can } from "@/components/common/can";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ApprovalPolicyView, PolicyFormOptions } from "@/types/approval";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { formatMoney } from "./format";
import { PolicyFormDialog } from "./policy-form-dialog";

interface Props {
  policies: ApprovalPolicyView[];
  options: PolicyFormOptions;
}

function RuleSummary({ policy }: { policy: ApprovalPolicyView }) {
  const t = useTranslations("approvals.policies");
  if (policy.appliesToAll)
    return <Badge variant="secondary">{t("appliesToAll")}</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {policy.costThreshold !== null && (
        <Badge variant="secondary" className="tabular-nums">
          {t("thresholdRule", {
            amount: formatMoney(
              policy.costThreshold,
              policy.costThresholdCurrency
            ),
          })}
        </Badge>
      )}
      {policy.categoryIds.length > 0 && (
        <Badge variant="secondary">
          {t("categoryRule", { count: policy.categoryIds.length })}
        </Badge>
      )}
    </div>
  );
}

export function PolicyManager({ policies, options }: Props) {
  const t = useTranslations("approvals.policies");
  const tf = useTranslations("approvals.policies.form");
  const tc = useTranslations("approvals.common");
  const router = useRouter();
  const [editing, setEditing] = useState<ApprovalPolicyView | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ApprovalPolicyView | null>(null);
  const [isPending, startTransition] = useTransition();

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (policy: ApprovalPolicyView) => {
    setEditing(policy);
    setDialogOpen(true);
  };
  const refresh = () => router.refresh();

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= policies.length) return;
    const ids = policies.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    startTransition(async () => {
      const res = await reorderApprovalPolicies(ids);
      if (!res.success) toast.error(res.error ?? tc("errorGeneric"));
      refresh();
    });
  };

  const toggle = (policy: ApprovalPolicyView, isActive: boolean) =>
    startTransition(async () => {
      const res = await setPolicyActive(policy.id, isActive);
      if (!res.success) toast.error(res.error ?? tc("errorGeneric"));
      refresh();
    });

  const confirmDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteApprovalPolicy(deleting.id);
      if (!res.success) toast.error(res.error ?? tc("errorGeneric"));
      else toast.success(t("deleted"));
      setDeleting(null);
      refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="text-primary h-5 w-5" />
            {t("title")}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            {t("description")}
          </p>
        </div>
        <Can permission="approval_policies:manage">
          <Button onClick={openNew} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("new")}
          </Button>
        </Can>
      </div>

      {policies.length === 0 ? (
        <div className="border-border flex flex-col items-center rounded-lg border border-dashed py-12 text-center">
          <ShieldCheck className="text-muted-foreground mb-3 h-8 w-8" />
          <p className="text-sm font-medium">{t("empty")}</p>
          <p className="text-muted-foreground text-xs">{t("emptyHint")}</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {policies.map((policy, index) => (
            <li
              key={policy.id}
              className={cn(
                "border-border bg-card flex flex-col gap-3 rounded-md border p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center",
                !policy.isActive && "opacity-60"
              )}
            >
              <div className="flex items-center gap-1 sm:flex-col">
                <Can permission="approval_policies:manage">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0 || isPending}
                    onClick={() => move(index, -1)}
                    aria-label={t("moveUp")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === policies.length - 1 || isPending}
                    onClick={() => move(index, 1)}
                    aria-label={t("moveDown")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </Can>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                    #{index + 1}
                  </span>
                  <p className="font-medium">{policy.name}</p>
                  {!policy.isActive && (
                    <Badge variant="outline">{t("inactive")}</Badge>
                  )}
                </div>
                {policy.description && (
                  <p className="text-muted-foreground text-sm">
                    {policy.description}
                  </p>
                )}
                <RuleSummary policy={policy} />
                <p className="text-muted-foreground text-xs">
                  {policy.steps
                    .map(
                      (s) =>
                        `${s.stepOrder}. ${s.label} (${tf(`approverTypes.${s.approverType}`)})`
                    )
                    .join(" → ")}
                  {" · "}
                  {t("requestCount", { count: policy.requestCount })}
                </p>
              </div>
              <Can permission="approval_policies:manage">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={policy.isActive}
                    onCheckedChange={(v) => toggle(policy, v)}
                    disabled={isPending}
                    aria-label={policy.isActive ? t("active") : t("inactive")}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(policy)}
                    aria-label={tc("edit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                    onClick={() => setDeleting(policy)}
                    aria-label={tc("delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Can>
            </li>
          ))}
        </ol>
      )}

      <PolicyFormDialog
        open={dialogOpen}
        policy={editing}
        options={options}
        onOpenChange={setDialogOpen}
        onSaved={refresh}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
