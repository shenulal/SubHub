"use client";

import {
  createCostCenter,
  deleteCostCenter,
  updateCostCenter,
  type CostCenterOptions,
} from "@/actions/platform/masters/cost-centers";
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
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/fx/convert";
import type { CostCenterRow } from "@/types/platform";
import { Loader2, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ConfirmDelete,
  EMPTY_SELECT_VALUE,
  Field,
  fromSelect,
  PanelHeader,
  StatusBadge,
  toSelect,
} from "./master-shared";

interface CostCentersPanelProps {
  rows: CostCenterRow[];
  options: CostCenterOptions;
  canManage: boolean;
}

interface Draft {
  id: string | null;
  code: string;
  name: string;
  description: string;
  ownerId: string | null;
  teamId: string | null;
  budgetMonthly: string;
  budgetCurrency: string;
  isActive: boolean;
}

function emptyDraft(baseCurrency: string): Draft {
  return {
    id: null,
    code: "",
    name: "",
    description: "",
    ownerId: null,
    teamId: null,
    budgetMonthly: "",
    budgetCurrency: baseCurrency,
    isActive: true,
  };
}

function toDraft(row: CostCenterRow, baseCurrency: string): Draft {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? "",
    ownerId: row.ownerId,
    teamId: row.teamId,
    budgetMonthly: row.budgetMonthly === null ? "" : String(row.budgetMonthly),
    budgetCurrency: row.budgetCurrency ?? baseCurrency,
    isActive: row.isActive,
  };
}

export function CostCentersPanel({
  rows,
  options,
  canManage,
}: CostCentersPanelProps) {
  const t = useTranslations("platform.masters.costCenters");
  const tc = useTranslations("platform.masters.common");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const save = () => {
    if (!draft) return;
    const payload = {
      code: draft.code,
      name: draft.name,
      description: draft.description || null,
      ownerId: draft.ownerId,
      teamId: draft.teamId,
      budgetMonthly: draft.budgetMonthly === "" ? null : draft.budgetMonthly,
      budgetCurrency: draft.budgetCurrency || null,
      isActive: draft.isActive,
    };
    startTransition(async () => {
      const result = draft.id
        ? await updateCostCenter(draft.id, payload)
        : await createCostCenter(payload);
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
            <Button
              size="sm"
              onClick={() => setDraft(emptyDraft(options.baseCurrency))}
            >
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
                      onClick={() =>
                        setDraft(toDraft(row, options.baseCurrency))
                      }
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("editTitle") : t("addTitle")}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="cc-code"
                label={tc("code")}
                hint={errors.code?.join(", ")}
              >
                <Input
                  id="cc-code"
                  value={draft.code}
                  onChange={(e) =>
                    setDraft({ ...draft, code: e.target.value.toUpperCase() })
                  }
                  className="font-mono uppercase"
                />
              </Field>
              <Field
                id="cc-name"
                label={tc("name")}
                hint={errors.name?.join(", ")}
              >
                <Input
                  id="cc-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field id="cc-description" label={t("descriptionLabel")}>
                  <Textarea
                    id="cc-description"
                    rows={2}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field id="cc-owner" label={t("owner")}>
                <Select
                  value={toSelect(draft.ownerId)}
                  onValueChange={(v) =>
                    setDraft({ ...draft, ownerId: fromSelect(v) })
                  }
                >
                  <SelectTrigger id="cc-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>
                      {tc("none")}
                    </SelectItem>
                    {options.owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="cc-team" label={t("team")}>
                <Select
                  value={toSelect(draft.teamId)}
                  onValueChange={(v) =>
                    setDraft({ ...draft, teamId: fromSelect(v) })
                  }
                >
                  <SelectTrigger id="cc-team">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>
                      {tc("none")}
                    </SelectItem>
                    {options.teams.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="cc-budget"
                label={t("monthlyBudget")}
                hint={errors.budgetMonthly?.join(", ")}
              >
                <Input
                  id="cc-budget"
                  inputMode="decimal"
                  value={draft.budgetMonthly}
                  onChange={(e) =>
                    setDraft({ ...draft, budgetMonthly: e.target.value })
                  }
                  className="font-mono"
                />
              </Field>
              <Field id="cc-currency" label={t("budgetCurrency")}>
                <Select
                  value={draft.budgetCurrency}
                  onValueChange={(v) =>
                    setDraft({ ...draft, budgetCurrency: v })
                  }
                >
                  <SelectTrigger id="cc-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.currencies.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(v) => setDraft({ ...draft, isActive: v })}
                />
                {tc("active")}
              </label>
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
