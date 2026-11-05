"use client";

import {
  deletePaymentMethod,
  reorderPaymentMethods,
} from "@/actions/platform/masters/payment-methods";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MasterOption, PaymentMethodRow } from "@/types/platform";
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ConfirmDelete,
  DefaultBadge,
  PanelHeader,
  StatusBadge,
} from "./master-shared";
import { PaymentMethodDialog } from "./payment-method-dialog";

interface PaymentMethodsPanelProps {
  rows: PaymentMethodRow[];
  cards: MasterOption[];
  canManage: boolean;
}

type DialogState = { row: PaymentMethodRow | null } | null;

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
  const [dialog, setDialog] = useState<DialogState>(null);
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
            <Button size="sm" onClick={() => setDialog({ row: null })}>
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
                      onClick={() => setDialog({ row })}
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

      {dialog && (
        <PaymentMethodDialog
          key={dialog.row?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          method={dialog.row}
          cards={cards}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
