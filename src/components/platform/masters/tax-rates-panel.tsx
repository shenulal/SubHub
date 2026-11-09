"use client";

import {
  createTaxRate,
  deleteTaxRate,
  updateTaxRate,
} from "@/actions/platform/masters/tax-rates";
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
import type { TaxRateRow } from "@/types/platform";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  MasterListNoMatches,
  MasterListToolbar,
  useMasterList,
} from "./master-list";
import {
  ConfirmDelete,
  DefaultBadge,
  Field,
  PanelHeader,
  StatusBadge,
} from "./master-shared";

interface TaxRatesPanelProps {
  rows: TaxRateRow[];
  canManage: boolean;
}

interface Draft {
  id: string | null;
  name: string;
  countryCode: string;
  ratePercent: string;
  isDefault: boolean;
  isActive: boolean;
  validFrom: string;
  validTo: string;
}

const EMPTY: Draft = {
  id: null,
  name: "",
  countryCode: "",
  ratePercent: "0",
  isDefault: false,
  isActive: true,
  validFrom: "",
  validTo: "",
};

function toDraft(row: TaxRateRow): Draft {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.countryCode ?? "",
    ratePercent: String(row.ratePercent),
    isDefault: row.isDefault,
    isActive: row.isActive,
    validFrom: row.validFrom?.slice(0, 10) ?? "",
    validTo: row.validTo?.slice(0, 10) ?? "",
  };
}

function dateLabel(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

export function TaxRatesPanel({ rows, canManage }: TaxRatesPanelProps) {
  const t = useTranslations("platform.masters.taxRates");
  const tc = useTranslations("platform.masters.common");
  const list = useMasterList(rows, {
    searchText: (r) => [r.name, r.countryCode, `${r.ratePercent}`],
    isActive: (r) => r.isActive,
  });
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const save = () => {
    if (!draft) return;
    const payload = {
      name: draft.name,
      countryCode: draft.countryCode.toUpperCase() || null,
      ratePercent: draft.ratePercent,
      isDefault: draft.isDefault,
      isActive: draft.isActive,
      validFrom: draft.validFrom || null,
      validTo: draft.validTo || null,
    };
    startTransition(async () => {
      const result = draft.id
        ? await updateTaxRate(draft.id, payload)
        : await createTaxRate(payload);
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
      const result = await deleteTaxRate(id);
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
      <MasterListToolbar list={list} searchPlaceholder={t("search")} />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{tc("name")}</TableHead>
              <TableHead className="w-24">{t("country")}</TableHead>
              <TableHead className="w-24 text-right">{t("rate")}</TableHead>
              <TableHead>{t("validity")}</TableHead>
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
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center text-sm"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.length > 0 && list.visible.length === 0 && (
              <MasterListNoMatches colSpan={canManage ? 6 : 5} />
            )}
            {list.visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    {row.name}
                    {row.isDefault && <DefaultBadge />}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.countryCode ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {row.ratePercent}%
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {dateLabel(row.validFrom)} → {dateLabel(row.validTo)}
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
                id="tax-name"
                label={tc("name")}
                hint={errors.name?.join(", ")}
              >
                <Input
                  id="tax-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field
                id="tax-rate"
                label={t("rate")}
                hint={errors.ratePercent?.join(", ")}
              >
                <Input
                  id="tax-rate"
                  inputMode="decimal"
                  value={draft.ratePercent}
                  onChange={(e) =>
                    setDraft({ ...draft, ratePercent: e.target.value })
                  }
                  className="font-mono"
                />
              </Field>
              <Field
                id="tax-country"
                label={t("country")}
                hint={t("countryHint")}
              >
                <Input
                  id="tax-country"
                  maxLength={2}
                  value={draft.countryCode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      countryCode: e.target.value.toUpperCase(),
                    })
                  }
                  className="font-mono uppercase"
                />
              </Field>
              <div className="flex items-end gap-6 pb-1">
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
              <Field id="tax-from" label={t("validFrom")}>
                <Input
                  id="tax-from"
                  type="date"
                  value={draft.validFrom}
                  onChange={(e) =>
                    setDraft({ ...draft, validFrom: e.target.value })
                  }
                />
              </Field>
              <Field id="tax-to" label={t("validTo")}>
                <Input
                  id="tax-to"
                  type="date"
                  value={draft.validTo}
                  onChange={(e) =>
                    setDraft({ ...draft, validTo: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              {tc("cancel")}
            </Button>
            <Button onClick={save} disabled={isPending || !draft?.name}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
