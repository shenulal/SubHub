"use client";

/** Create / edit dialog for the platform-wide country master. */
import {
  createCountry,
  updateCountry,
} from "@/actions/platform/masters/countries";
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
import type { CountryRow } from "@/types/platform";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  EMPTY_SELECT_VALUE,
  Field,
  fromSelect,
  toSelect,
} from "./master-shared";

export interface CountryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country?: CountryRow | null;
  /** Active currency codes from the currency master. */
  currencyCodes: string[];
  onSaved?: (code: string) => void;
}

interface Draft {
  code: string;
  name: string;
  region: string;
  currencyCode: string | null;
  defaultTaxRatePercent: string;
  phonePrefix: string;
  isActive: boolean;
}

function initialDraft(country: CountryRow | null | undefined): Draft {
  return {
    code: country?.code ?? "",
    name: country?.name ?? "",
    region: country?.region ?? "",
    currencyCode: country?.currencyCode ?? null,
    defaultTaxRatePercent:
      country?.defaultTaxRatePercent === null ||
      country?.defaultTaxRatePercent === undefined
        ? ""
        : String(country.defaultTaxRatePercent),
    phonePrefix: country?.phonePrefix ?? "",
    isActive: country?.isActive ?? true,
  };
}

export function CountryDialog({
  open,
  onOpenChange,
  country,
  currencyCodes,
  onSaved,
}: CountryDialogProps) {
  const t = useTranslations("platform.masters.countries");
  const tc = useTranslations("platform.masters.common");
  const isEdit = Boolean(country);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(country));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    const payload = {
      code: draft.code,
      name: draft.name,
      region: draft.region || null,
      currencyCode: draft.currencyCode,
      defaultTaxRatePercent:
        draft.defaultTaxRatePercent === "" ? null : draft.defaultTaxRatePercent,
      phonePrefix: draft.phonePrefix,
      isActive: draft.isActive,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateCountry(draft.code, payload)
        : await createCountry(payload);
      if (!result.success) {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
        return;
      }
      toast.success(tc("saved"));
      onOpenChange(false);
      onSaved?.(draft.code.toUpperCase());
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="country-code"
            label={tc("code")}
            hint={
              errors.code?.join(", ") ?? (isEdit ? undefined : t("codeHint"))
            }
          >
            <Input
              id="country-code"
              value={draft.code}
              maxLength={2}
              disabled={isEdit}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </Field>
          <Field
            id="country-name"
            label={tc("name")}
            hint={errors.name?.join(", ")}
          >
            <Input
              id="country-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field id="country-region" label={t("region")}>
            <Input
              id="country-region"
              value={draft.region}
              onChange={(e) => set({ region: e.target.value })}
            />
          </Field>
          <Field id="country-currency" label={t("currency")}>
            <Select
              value={toSelect(draft.currencyCode)}
              onValueChange={(v) => set({ currencyCode: fromSelect(v) })}
            >
              <SelectTrigger id="country-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
                {currencyCodes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="country-tax"
            label={t("defaultTax")}
            hint={errors.defaultTaxRatePercent?.join(", ")}
          >
            <Input
              id="country-tax"
              inputMode="decimal"
              value={draft.defaultTaxRatePercent}
              onChange={(e) => set({ defaultTaxRatePercent: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field
            id="country-phone"
            label={t("phonePrefix")}
            hint={errors.phonePrefix?.join(", ") ?? t("phoneHint")}
          >
            <Input
              id="country-phone"
              value={draft.phonePrefix}
              onChange={(e) => set({ phonePrefix: e.target.value })}
              className="font-mono"
            />
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
            disabled={isPending || !draft.code || !draft.name}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
