"use client";

/**
 * Create / edit dialog for the platform-wide currency master. Used by the
 * Currencies tab and for inline creation from currency pickers.
 */
import {
  createCurrency,
  updateCurrency,
} from "@/actions/platform/masters/currencies";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CurrencyRow } from "@/types/platform";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field } from "./master-shared";

export interface CurrencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing currency to edit; omit to create. */
  currency?: CurrencyRow | null;
  /** Prefill for a new currency (typed search text). */
  defaultCode?: string;
  /** Offer "enable for this workspace" (create only). */
  canEnable?: boolean;
  onSaved?: (code: string) => void;
}

interface Draft {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: string;
  numericCode: string;
  sortOrder: string;
  isActive: boolean;
  enable: boolean;
}

const DEFAULT_DECIMALS = "2";
const DEFAULT_SORT = "100";

function initialDraft(
  currency: CurrencyRow | null | undefined,
  defaultCode: string | undefined,
  canEnable: boolean
): Draft {
  if (currency) {
    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalDigits: String(currency.decimalDigits),
      numericCode: currency.numericCode ?? "",
      sortOrder: String(currency.sortOrder),
      isActive: currency.isActive,
      enable: false,
    };
  }
  const code = (defaultCode ?? "").trim();
  const looksLikeCode = /^[A-Za-z]{3}$/.test(code);
  return {
    code: looksLikeCode ? code.toUpperCase() : "",
    name: looksLikeCode ? "" : code,
    symbol: "",
    decimalDigits: DEFAULT_DECIMALS,
    numericCode: "",
    sortOrder: DEFAULT_SORT,
    isActive: true,
    enable: canEnable,
  };
}

export function CurrencyDialog({
  open,
  onOpenChange,
  currency,
  defaultCode,
  canEnable = false,
  onSaved,
}: CurrencyDialogProps) {
  const t = useTranslations("platform.masters.currencies");
  const tc = useTranslations("platform.masters.common");
  const isEdit = Boolean(currency);
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft(currency, defaultCode, canEnable)
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    const payload = {
      code: draft.code,
      name: draft.name,
      symbol: draft.symbol,
      decimalDigits: draft.decimalDigits,
      numericCode: draft.numericCode,
      sortOrder: draft.sortOrder,
      isActive: draft.isActive,
      enableForOrganization: draft.enable,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateCurrency(draft.code, payload)
        : await createCurrency(payload);
      if (!result.success) {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
        return;
      }
      toast.success(isEdit ? tc("saved") : t("created"));
      onOpenChange(false);
      onSaved?.(draft.code.toUpperCase());
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("globalHint")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="cur-code"
            label={tc("code")}
            hint={
              errors.code?.join(", ") ?? (isEdit ? undefined : t("codeHint"))
            }
          >
            <Input
              id="cur-code"
              value={draft.code}
              maxLength={3}
              disabled={isEdit}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </Field>
          <Field
            id="cur-name"
            label={tc("name")}
            hint={errors.name?.join(", ")}
          >
            <Input
              id="cur-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field
            id="cur-symbol"
            label={t("symbol")}
            hint={errors.symbol?.join(", ")}
          >
            <Input
              id="cur-symbol"
              value={draft.symbol}
              maxLength={8}
              onChange={(e) => set({ symbol: e.target.value })}
            />
          </Field>
          <Field
            id="cur-decimals"
            label={t("decimalDigits")}
            hint={errors.decimalDigits?.join(", ")}
          >
            <Input
              id="cur-decimals"
              inputMode="numeric"
              value={draft.decimalDigits}
              onChange={(e) => set({ decimalDigits: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field
            id="cur-numeric"
            label={t("numericCode")}
            hint={errors.numericCode?.join(", ")}
          >
            <Input
              id="cur-numeric"
              inputMode="numeric"
              maxLength={3}
              value={draft.numericCode}
              onChange={(e) => set({ numericCode: e.target.value })}
              className="font-mono"
            />
          </Field>
          <Field id="cur-sort" label={t("sortOrder")}>
            <Input
              id="cur-sort"
              inputMode="numeric"
              value={draft.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
              className="font-mono"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(v) => set({ isActive: v })}
              />
              {tc("active")}
            </label>
            {!isEdit && canEnable && (
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.enable}
                  onCheckedChange={(v) => set({ enable: v })}
                />
                {t("enableNow")}
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={save}
            disabled={isPending || !draft.code || !draft.name || !draft.symbol}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
