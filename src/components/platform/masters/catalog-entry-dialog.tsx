"use client";

/** Create / edit dialog for a vendor catalog entry (`catalog:manage`). */
import {
  createCatalogEntry,
  editCatalogEntry,
} from "@/actions/taxonomy/catalog-admin";
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
import { CATALOG_PRICING_MODELS } from "@/lib/validations/taxonomy";
import type { MasterOption } from "@/types/platform";
import type { CatalogItemDto } from "@/types/taxonomy";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CurrencyDialog } from "./currency-dialog";
import {
  EMPTY_SELECT_VALUE,
  Field,
  fromSelect,
  toSelect,
} from "./master-shared";

export interface CatalogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: CatalogItemDto | null;
  categories: string[];
  currencyCodes: string[];
  countries: MasterOption[];
  canManageGlobal: boolean;
  onSaved?: (entry: CatalogItemDto) => void;
}

interface Draft {
  name: string;
  vendorName: string;
  category: string;
  subcategory: string;
  description: string;
  website: string;
  pricingModel: string | null;
  basePricePerSeat: string;
  basePriceCurrency: string | null;
  aliases: string;
  cancellationUrl: string;
  billingPortalUrl: string;
  noticePeriodDays: string;
  countryCode: string | null;
  isActive: boolean;
}

function initialDraft(e: CatalogItemDto | null | undefined): Draft {
  return {
    name: e?.name ?? "",
    vendorName: e?.vendorName ?? "",
    category: e?.category ?? "",
    subcategory: e?.subcategory ?? "",
    description: e?.description ?? "",
    website: e?.website ?? "",
    pricingModel: e?.pricingModel ?? null,
    basePricePerSeat:
      e?.basePricePerSeat === null || e?.basePricePerSeat === undefined
        ? ""
        : String(e.basePricePerSeat),
    basePriceCurrency: e?.basePriceCurrency ?? null,
    aliases: (e?.aliases ?? []).join(", "),
    cancellationUrl: e?.cancellationUrl ?? "",
    billingPortalUrl: e?.billingPortalUrl ?? "",
    noticePeriodDays:
      e?.noticePeriodDays === null || e?.noticePeriodDays === undefined
        ? ""
        : String(e.noticePeriodDays),
    countryCode: e?.countryCode ?? null,
    isActive: e?.isActive ?? true,
  };
}

function toPayload(d: Draft) {
  return {
    name: d.name,
    vendorName: d.vendorName || null,
    category: d.category,
    subcategory: d.subcategory || null,
    description: d.description || null,
    website: d.website || null,
    pricingModel: (d.pricingModel ?? null) as
      | (typeof CATALOG_PRICING_MODELS)[number]
      | null,
    basePricePerSeat:
      d.basePricePerSeat === "" ? null : Number(d.basePricePerSeat),
    basePriceCurrency: d.basePriceCurrency,
    aliases: d.aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean),
    cancellationUrl: d.cancellationUrl || null,
    billingPortalUrl: d.billingPortalUrl || null,
    noticePeriodDays:
      d.noticePeriodDays === "" ? null : Number(d.noticePeriodDays),
    countryCode: d.countryCode,
    isActive: d.isActive,
  };
}

export function CatalogEntryDialog({
  open,
  onOpenChange,
  entry,
  categories,
  currencyCodes,
  countries,
  canManageGlobal,
  onSaved,
}: CatalogEntryDialogProps) {
  const t = useTranslations("platform.masters.catalog");
  const tc = useTranslations("platform.masters.common");
  const ti = useTranslations("platform.masters.inline");
  const isEdit = Boolean(entry);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(entry));
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [extraCurrencies, setExtraCurrencies] = useState<string[]>([]);
  const [newCurrency, setNewCurrency] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const err = (k: string) => errors[k]?.join(", ");

  const categoryList = Array.from(
    new Set([...categories, ...extraCategories, draft.category].filter(Boolean))
  ).sort();
  const currencyList = Array.from(
    new Set([...currencyCodes, ...extraCurrencies])
  );

  const save = () => {
    startTransition(async () => {
      const payload = toPayload(draft);
      const result =
        isEdit && entry
          ? await editCatalogEntry(entry.id, payload)
          : await createCatalogEntry(payload);
      if (!result.success || !result.data) {
        setErrors(result.errors ?? {});
        toast.error(result.error ?? tc("saveFailed"));
        return;
      }
      toast.success(tc("saved"));
      onOpenChange(false);
      onSaved?.(result.data);
    });
  };

  const text = (key: keyof Draft, id: string, label: string, mono = false) => (
    <Field id={id} label={label} hint={err(key)}>
      <Input
        id={id}
        value={String(draft[key] ?? "")}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)}
        className={mono ? "font-mono" : undefined}
      />
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "cat-entry-name", tc("name"))}
          {text("vendorName", "cat-entry-vendor", t("vendor"))}
          <Field
            id="cat-entry-category"
            label={t("category")}
            hint={err("category")}
          >
            <Select
              value={draft.category}
              onValueChange={(v) => set({ category: v })}
            >
              <SelectTrigger id="cat-entry-category" className="w-full">
                <SelectValue placeholder={t("category")} />
              </SelectTrigger>
              <SelectContent
                createOption={{
                  label: (q) =>
                    q ? t("newCategory", { name: q }) : ti("createEmpty"),
                  onCreate: (q) => {
                    if (!q) return;
                    setExtraCategories((c) => [...c, q]);
                    set({ category: q });
                  },
                }}
              >
                {categoryList.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {text("subcategory", "cat-entry-sub", t("subcategory"))}
          {text("website", "cat-entry-website", t("website"))}
          <Field id="cat-entry-pricing" label={t("pricingModel")}>
            <Select
              value={toSelect(draft.pricingModel)}
              onValueChange={(v) => set({ pricingModel: fromSelect(v) })}
            >
              <SelectTrigger id="cat-entry-pricing" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
                {CATALOG_PRICING_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`pricingModels.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {text("basePricePerSeat", "cat-entry-price", t("basePrice"), true)}
          <Field id="cat-entry-currency" label={t("priceCurrency")}>
            <Select
              value={toSelect(draft.basePriceCurrency)}
              onValueChange={(v) => set({ basePriceCurrency: fromSelect(v) })}
            >
              <SelectTrigger id="cat-entry-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                createOption={
                  canManageGlobal
                    ? {
                        label: (q) =>
                          q ? ti("create", { name: q }) : ti("createEmpty"),
                        onCreate: (q) => setNewCurrency(q),
                      }
                    : undefined
                }
              >
                <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
                {currencyList.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              id="cat-entry-aliases"
              label={t("aliases")}
              hint={err("aliases") ?? t("aliasesHint")}
            >
              <Input
                id="cat-entry-aliases"
                value={draft.aliases}
                onChange={(e) => set({ aliases: e.target.value })}
              />
            </Field>
          </div>
          {text("cancellationUrl", "cat-entry-cancel", t("cancellationUrl"))}
          {text("billingPortalUrl", "cat-entry-billing", t("billingPortalUrl"))}
          {text(
            "noticePeriodDays",
            "cat-entry-notice",
            t("noticePeriod"),
            true
          )}
          <Field id="cat-entry-country" label={t("country")}>
            <Select
              value={toSelect(draft.countryCode)}
              onValueChange={(v) => set({ countryCode: fromSelect(v) })}
            >
              <SelectTrigger id="cat-entry-country" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>{tc("none")}</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field id="cat-entry-desc" label={t("descriptionLabel")}>
              <Textarea
                id="cat-entry-desc"
                rows={2}
                value={draft.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </Field>
          </div>
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
            disabled={isPending || !draft.name.trim() || !draft.category}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
        {newCurrency !== null && (
          <CurrencyDialog
            open
            onOpenChange={(o) => !o && setNewCurrency(null)}
            defaultCode={newCurrency}
            onSaved={(code) => {
              setExtraCurrencies((c) => [...c, code]);
              set({ basePriceCurrency: code });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
