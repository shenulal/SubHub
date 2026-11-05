"use client";

/**
 * Create / edit dialog for a payment method. Used by Master data → Payment
 * methods and for inline creation from payment-method pickers.
 */
import {
  createPaymentMethod,
  listCorporateCardOptions,
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
import { paymentMethodKindSchema } from "@/lib/validations/platform";
import type { MasterOption, PaymentMethodRow } from "@/types/platform";
import type { PaymentMethodKind } from "@prisma/client";
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

/** DB enum `PaymentMethodKind` — drives card linking, so it stays code-defined. */
const KINDS = paymentMethodKindSchema.options;

export interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?: PaymentMethodRow | null;
  /** Corporate cards; fetched when omitted. */
  cards?: MasterOption[];
  defaultName?: string;
  onSaved?: (saved: { id: string; name: string }) => void;
}

interface Draft {
  code: string;
  name: string;
  kind: PaymentMethodKind;
  corporateCardId: string | null;
  isActive: boolean;
  isDefault: boolean;
}

function initialDraft(
  row: PaymentMethodRow | null | undefined,
  defaultName: string | undefined
): Draft {
  if (row) {
    return {
      code: row.code,
      name: row.name,
      kind: row.kind,
      corporateCardId: row.corporateCardId,
      isActive: row.isActive,
      isDefault: row.isDefault,
    };
  }
  const name = (defaultName ?? "").trim();
  return {
    code: codeFromName(name),
    name,
    kind: "CARD",
    corporateCardId: null,
    isActive: true,
    isDefault: false,
  };
}

function useCards(preloaded?: MasterOption[]): MasterOption[] {
  const [cards, setCards] = useState<MasterOption[]>(preloaded ?? []);
  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;
    void listCorporateCardOptions().then((r) => {
      if (!cancelled && r.success && r.data) setCards(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [preloaded]);
  return cards;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  method,
  cards: preloaded,
  defaultName,
  onSaved,
}: PaymentMethodDialogProps) {
  const t = useTranslations("platform.masters.paymentMethods");
  const tc = useTranslations("platform.masters.common");
  const cards = useCards(preloaded);
  const [draft, setDraft] = useState<Draft>(() =>
    initialDraft(method, defaultName)
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    const payload = { ...draft };
    startTransition(async () => {
      const result = method
        ? await updatePaymentMethod(method.id, payload)
        : await createPaymentMethod(payload);
      if (!result.success) {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
        return;
      }
      toast.success(tc("saved"));
      onOpenChange(false);
      const id = method?.id ?? (result.data as { id: string }).id;
      onSaved?.({ id, name: draft.name });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{method ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="pm-code" label={tc("code")} hint={errors.code?.join(", ")}>
            <Input
              id="pm-code"
              value={draft.code}
              onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              className="font-mono uppercase"
            />
          </Field>
          <Field id="pm-name" label={tc("name")} hint={errors.name?.join(", ")}>
            <Input
              id="pm-name"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
          <Field id="pm-kind" label={t("kind")}>
            <Select
              value={draft.kind}
              onValueChange={(v) => set({ kind: v as PaymentMethodKind })}
            >
              <SelectTrigger id="pm-kind" className="w-full">
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
              onValueChange={(v) => set({ corporateCardId: fromSelect(v) })}
              disabled={draft.kind !== "CARD"}
            >
              <SelectTrigger id="pm-card" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
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
                onCheckedChange={(v) => set({ isDefault: v })}
              />
              {tc("default")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.isActive}
                onCheckedChange={(v) => set({ isActive: v })}
              />
              {tc("active")}
            </label>
          </div>
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
