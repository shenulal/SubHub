"use client";

import {
  createPaymentMethod,
  deletePaymentMethod,
  reorderPaymentMethods,
  updatePaymentMethod,
} from "@/actions/platform/masters/payment-methods";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MasterOption, PaymentMethodRow } from "@/types/platform";
import type { PaymentMethodKind } from "@prisma/client";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ConfirmDelete,
  DefaultBadge,
  EMPTY_SELECT_VALUE,
  Field,
  fromSelect,
  PanelHeader,
  StatusBadge,
  toSelect,
} from "./master-shared";

interface PaymentMethodsPanelProps {
  rows: PaymentMethodRow[];
  cards: MasterOption[];
  canManage: boolean;
}

const KINDS: PaymentMethodKind[] = [
  "CARD",
  "BANK",
  "INVOICE",
  "WALLET",
  "OTHER",
];

interface Draft {
  id: string | null;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  corporateCardId: string | null;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY: Draft = {
  id: null,
  code: "",
  name: "",
  kind: "CARD",
  corporateCardId: null,
  isActive: true,
  isDefault: false,
};

function toDraft(row: PaymentMethodRow): Draft {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    corporateCardId: row.corporateCardId,
    isActive: row.isActive,
    isDefault: row.isDefault,
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function PaymentMethodsPanel({
  rows,
  cards,
  canManage,
}: PaymentMethodsPanelProps) {
  const t = useTranslations("platform.masters.paymentMethods");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [ordered, setOrdered] = useState(rows);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => setOrdered(rows), [rows]);

  const reorder = (from: number, to: number) => {
    const next = move(ordered, from, to);
    if (next === ordered) return;
    setOrdered(next);
    startTransition(async () => {
      const result = await reorderPaymentMethods({
        ids: next.map((r) => r.id),
      });
      if (!result.success) {
        toast.error(result.error ?? tc("saveFailed"));
        setOrdered(rows);
      }
    });
  };

  const save = () => {
    if (!draft) return;
    const payload = {
      code: draft.code,
      name: draft.name,
      kind: draft.kind,
      corporateCardId: draft.corporateCardId,
      isActive: draft.isActive,
      isDefault: draft.isDefault,
    };
    startTransition(async () => {
      const result = draft.id
        ? await updatePaymentMethod(draft.id, payload)
        : await createPaymentMethod(payload);
      if (result.success) {
        toast.success(tc("saved"));
        setDraft(null);
        setErrors({});
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
      }
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deletePaymentMethod(id);
      if (result.success) {
        toast.success(result.message ?? tc("deleted"));
        router.refresh();
      } else toast.error(result.error ?? tc("saveFailed"));
    });
  };

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
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canManage && (
                <TableHead className="w-20">{t("order")}</TableHead>
              )}
              <TableHead className="w-36">{tc("code")}</TableHead>
              <TableHead>{tc("name")}</TableHead>
              <TableHead className="w-24">{t("kind")}</TableHead>
              <TableHead>{t("linkedCard")}</TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              {canManage && (
                <TableHead className="w-24 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((row, index) => (
              <TableRow key={row.id}>
                {canManage && (
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("moveUp")}
                        disabled={index === 0 || isPending}
                        onClick={() => reorder(index, index - 1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("moveDown")}
                        disabled={index === ordered.length - 1 || isPending}
                        onClick={() => reorder(index, index + 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs font-medium">
                  {row.code}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    {row.name}
                    {row.isDefault && <DefaultBadge />}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="tonal-neutral rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide">
                    {row.kind}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.corporateCardLabel ?? "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge active={row.isActive} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={tc("edit")}
                      onClick={() => setDraft(toDraft(row))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
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

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("editTitle") : t("addTitle")}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="pm-code"
                label={tc("code")}
                hint={errors.code?.join(", ")}
              >
                <Input
                  id="pm-code"
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase() })
                  }
                  className="font-mono uppercase"
                />
              </Field>
              <Field
                id="pm-name"
                label={tc("name")}
                hint={errors.name?.join(", ")}
              >
                <Input
                  id="pm-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field id="pm-kind" label={t("kind")}>
                <Select
                  value={draft.kind}
                  onValueChange={(v) =>
                    setDraft({ ...draft, kind: v as PaymentMethodKind })
                  }
                >
                  <SelectTrigger id="pm-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="pm-card" label={t("linkedCard")}>
                <Select
                  value={toSelect(draft.corporateCardId)}
                  onValueChange={(v) =>
                    setDraft({ ...draft, corporateCardId: fromSelect(v) })
                  }
                  disabled={draft.kind !== "CARD"}
                >
                  <SelectTrigger id="pm-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>
                      {tc("none")}
                    </SelectItem>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center gap-6 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.isDefault}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, isDefault: v })
                    }
                  />
                  {tc("default")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                  />
                  {tc("active")}
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={save}
              disabled={isPending || !draft?.name || !draft?.code}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
