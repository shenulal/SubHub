"use client";

/**
 * Create / edit dialog for a cost centre. Used by Master data → Cost centres
 * and for inline creation from cost-centre pickers (options load lazily).
 */
import {
  createCostCenter,
  listCostCenterOptions,
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
import { Textarea } from "@/components/ui/textarea";
import type { CostCenterRow } from "@/types/platform";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  codeFromName,
  EMPTY_SELECT_VALUE,
  Field,
  fromSelect,
  toSelect,
} from "./master-shared";

export interface CostCenterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costCenter?: CostCenterRow | null;
  /** Pre-loaded owners/teams/currencies; fetched when omitted. */
  options?: CostCenterOptions;
  /** Prefill name (and derived code) for a new cost centre. */
  defaultName?: string;
  onSaved?: (saved: { id: string; code: string; name: string }) => void;
}

interface Draft {
  code: string;
  name: string;
  description: string;
  ownerId: string | null;
  teamId: string | null;
  budgetMonthly: string;
  budgetCurrency: string;
  isActive: boolean;
}

const NO_OPTIONS: CostCenterOptions = {
  owners: [],
  teams: [],
  currencies: [],
  baseCurrency: "",
};

function initialDraft(
  row: CostCenterRow | null | undefined,
  defaultName: string | undefined,
  baseCurrency: string
): Draft {
  if (row) {
    return {
      code: row.code,
      name: row.name,
      description: row.description ?? "",
      ownerId: row.ownerId,
      teamId: row.teamId,
      budgetMonthly:
        row.budgetMonthly === null ? "" : String(row.budgetMonthly),
      budgetCurrency: row.budgetCurrency ?? baseCurrency,
      isActive: row.isActive,
    };
  }
  const name = (defaultName ?? "").trim();
  return {
    code: codeFromName(name),
    name,
    description: "",
    ownerId: null,
    teamId: null,
    budgetMonthly: "",
    budgetCurrency: baseCurrency,
    isActive: true,
  };
}

function useCostCenterOptions(preloaded?: CostCenterOptions) {
  const [options, setOptions] = useState<CostCenterOptions>(
    preloaded ?? NO_OPTIONS
  );
  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    void listCostCenterOptions().then((r) => {
      if (!cancelled && r.success && r.data) setOptions(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [preloaded]);
  return options;
}

export function CostCenterDialog({
  open,
  onOpenChange,
  costCenter,
  options: preloaded,
  defaultName,
  onSaved,
}: CostCenterDialogProps) {
  const t = useTranslations("platform.masters.costCenters");
  const tc = useTranslations("platform.masters.common");
  const options = useCostCenterOptions(preloaded);
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft(costCenter, defaultName, options.baseCurrency)
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    if (!draft.budgetCurrency && options.baseCurrency) {
      setDraft((d) => ({ ...d, budgetCurrency: options.baseCurrency }));
    }
  }, [options.baseCurrency, draft.budgetCurrency]);

  const save = () => {
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
      const result = costCenter
        ? await updateCostCenter(costCenter.id, payload)
        : await createCostCenter(payload);
      if (!result.success) {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
        return;
      }
      toast.success(tc("saved"));
      onOpenChange(false);
      const id = costCenter?.id ?? (result.data as { id: string }).id;
      onSaved?.({ id, code: draft.code, name: draft.name });
    });
  };

  const optionSelect = (
    id: string,
    value: string | null,
    items: { id: string; label: string }[],
    onChange: (v: string | null) => void
  ) => (
    <Select
      value={toSelect(value)}
      onValueChange={(v) => onChange(fromSelect(v))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
        {items.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {costCenter ? t("editTitle") : t("addTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="cc-code" label={tc("code")} hint={errors.code?.join(", ")}>
            <Input
              id="cc-code"
              value={draft.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </Field>
          <Field id="cc-name" label={tc("name")} hint={errors.name?.join(", ")}>
            <Input
              id="cc-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="cc-description" label={t("descriptionLabel")}>
              <Textarea
                id="cc-description"
                rows={2}
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
          </div>
          <Field id="cc-owner" label={t("owner")}>
            {optionSelect("cc-owner", draft.ownerId, options.owners, (v) =>
              set({ ownerId: v })
            )}
          </Field>
          <Field id="cc-team" label={t("team")}>
            {optionSelect("cc-team", draft.teamId, options.teams, (v) =>
              set({ teamId: v })
            )}
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
              onChange={(e) => set({ budgetMonthly: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field id="cc-currency" label={t("budgetCurrency")}>
            <Select
              value={draft.budgetCurrency}
              onValueChange={(v) => set({ budgetCurrency: v })}
            >
              <SelectTrigger id="cc-currency" className="w-full">
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
              onCheckedChange={(v) => set({ isActive: v })}
            />
            {tc("active")}
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={isPending || !draft.name || !draft.code}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
