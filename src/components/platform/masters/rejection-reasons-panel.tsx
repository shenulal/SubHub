// src/components/platform/masters/rejection-reasons-panel.tsx
"use client";

/**
 * Master data → Rejection reasons. Approvers pick one when they reject a
 * request. Read with `masters:read`; add / edit / deactivate / delete with
 * `masters:manage` (re-checked by the server actions).
 */
import {
  createRejectionReason,
  deleteRejectionReason,
  updateRejectionReason,
} from "@/actions/platform/masters/rejection-reasons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { RejectionReasonRow } from "@/types/approval";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ActiveToggleButton,
  codeFromName,
  ConfirmDelete,
  Field,
  PanelHeader,
  StatusBadge,
} from "./master-shared";

interface Draft {
  id: string | null;
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY: Draft = {
  id: null,
  code: "",
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

function toDraft(row: RejectionReasonRow): Draft {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    sortOrder: String(row.sortOrder),
    isActive: row.isActive,
  };
}

function toPayload(d: Draft) {
  return {
    code: d.code || codeFromName(d.name),
    name: d.name,
    description: d.description || null,
    sortOrder: d.sortOrder || "0",
    isActive: d.isActive,
  };
}

export function RejectionReasonsPanel({
  rows,
  canManage,
}: {
  rows: RejectionReasonRow[];
  canManage: boolean;
}) {
  const t = useTranslations("approvals.reasonsMaster");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const done = (ok: boolean, error?: string, message?: string) => {
    if (!ok) {
      toast.error(error ?? tc("saveFailed"));
      return false;
    }
    toast.success(message ?? tc("saved"));
    router.refresh();
    return true;
  };

  const save = () => {
    if (!draft) return;
    startTransition(async () => {
      const payload = toPayload(draft);
      const result = draft.id
        ? await updateRejectionReason(draft.id, payload)
        : await createRejectionReason(payload);
      setErrors(result.errors ?? {});
      if (done(result.success, result.error)) setDraft(null);
    });
  };

  const toggle = (row: RejectionReasonRow, isActive: boolean) =>
    startTransition(async () => {
      const result = await updateRejectionReason(row.id, {
        ...toPayload(toDraft(row)),
        isActive,
      });
      done(result.success, result.error);
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteRejectionReason(id);
      done(result.success, result.error, result.message ?? tc("deleted"));
    });

  return (
    <div>
      <PanelHeader
        title={t("title")}
        description={t("description")}
        action={
          canManage && (
            <Button size="sm" onClick={() => setDraft(EMPTY)}>
              <Plus className="size-4" />
              {t("add")}
            </Button>
          )
        }
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-right">
                {t("sortOrder")}
              </TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead className="w-32">{t("code")}</TableHead>
              <TableHead className="w-28">{t("usage")}</TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              {canManage && (
                <TableHead className="w-32 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {row.sortOrder}
                </TableCell>
                <TableCell className="max-w-[300px]">
                  <p className="truncate font-medium" title={row.name}>
                    {row.name}
                  </p>
                  {row.description && (
                    <p
                      className="text-muted-foreground truncate text-[0.8125rem]"
                      title={row.description}
                    >
                      {row.description}
                    </p>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {t("usageCount", { count: row.usageCount })}
                </TableCell>
                <TableCell>
                  <StatusBadge active={row.isActive} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${tc("edit")} ${row.name}`}
                      onClick={() => setDraft(toDraft(row))}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ActiveToggleButton
                      active={row.isActive}
                      label={row.name}
                      disabled={isPending}
                      onToggle={(next) => toggle(row, next)}
                    />
                    <ConfirmDelete
                      label={row.name}
                      onConfirm={() => remove(row.id)}
                      disabled={isPending}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
              <Field
                id="reason-name"
                label={t("name")}
                hint={errors.name?.join(", ")}
              >
                <Input
                  id="reason-name"
                  value={draft.name}
                  maxLength={100}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field
                id="reason-order"
                label={t("sortOrder")}
                hint={errors.sortOrder?.join(", ")}
              >
                <Input
                  id="reason-order"
                  inputMode="numeric"
                  value={draft.sortOrder}
                  onChange={(e) =>
                    setDraft({ ...draft, sortOrder: e.target.value })
                  }
                />
              </Field>
              <Field
                id="reason-code"
                label={t("code")}
                hint={errors.code?.join(", ") ?? t("codeHint")}
              >
                <Input
                  id="reason-code"
                  value={draft.code}
                  placeholder={codeFromName(draft.name)}
                  maxLength={32}
                  className="font-mono uppercase"
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                />
                {t("active")}
              </label>
              <div className="sm:col-span-2">
                <Field id="reason-description" label={t("descriptionLabel")}>
                  <Textarea
                    id="reason-description"
                    rows={2}
                    maxLength={300}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={save} disabled={isPending || !draft?.name.trim()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
