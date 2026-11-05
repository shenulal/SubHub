"use client";

import {
  deleteCostCenter,
  type CostCenterOptions,
} from "@/actions/platform/masters/cost-centers";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/fx/convert";
import type { CostCenterRow } from "@/types/platform";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CostCenterDialog } from "./cost-center-dialog";
import { ConfirmDelete, PanelHeader, StatusBadge } from "./master-shared";

interface CostCentersPanelProps {
  rows: CostCenterRow[];
  options: CostCenterOptions;
  canManage: boolean;
}

type DialogState = { row: CostCenterRow | null } | null;

export function CostCentersPanel({
  rows,
  options,
  canManage,
}: CostCentersPanelProps) {
  const t = useTranslations("platform.masters.costCenters");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [isPending, startTransition] = useTransition();

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteCostCenter(id);
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
              <TableHead className="w-28">{tc("code")}</TableHead>
              <TableHead>{tc("name")}</TableHead>
              <TableHead>{t("owner")}</TableHead>
              <TableHead>{t("team")}</TableHead>
              <TableHead className="text-right">{t("monthlyBudget")}</TableHead>
              <TableHead className="w-28">{tc("status")}</TableHead>
              {canManage && (
                <TableHead className="w-24 text-right">
                  {tc("actions")}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs font-medium">
                  {row.code}
                </TableCell>
                <TableCell className="max-w-[18rem]">
                  <div className="truncate font-medium" title={row.name}>
                    {row.name}
                  </div>
                  {row.description && (
                    <div
                      className="text-muted-foreground truncate text-[0.8125rem]"
                      title={row.description}
                    >
                      {row.description}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.ownerName ?? "—"}
                </TableCell>
                <TableCell className="text-sm">{row.teamName ?? "—"}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.budgetMonthly === null
                    ? "—"
                    : formatMoney(
                        row.budgetMonthly,
                        row.budgetCurrency ?? options.baseCurrency
                      )}
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
        <CostCenterDialog
          key={dialog.row?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          costCenter={dialog.row}
          options={options}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
