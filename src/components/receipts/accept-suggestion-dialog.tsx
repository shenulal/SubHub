// src/components/receipts/accept-suggestion-dialog.tsx
"use client";

import { acceptReceiptSuggestion } from "@/actions/receipts";
import { suggestCategory } from "@/actions/taxonomy/auto-categorize";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AcceptReceiptSuggestionInput } from "@/lib/validations/receipts";
import type { ReceiptSuggestionDTO } from "@/types/receipts";
import type { BillingCycle } from "@prisma/client";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { CYCLE_OPTIONS, toDateInput } from "./receipts.utils";

export interface CategoryOption {
  id: string;
  name: string;
  parentName?: string | null;
}

interface AcceptSuggestionDialogProps {
  suggestion: ReceiptSuggestionDTO | null;
  currencies: string[];
  categories: CategoryOption[];
  onClose: () => void;
  onAccepted: (linked: boolean) => void;
}

const NONE = "__none__";

function initialForm(s: ReceiptSuggestionDTO, currencies: string[]) {
  return {
    name: s.matchedCatalog?.name ?? s.vendorName,
    amount: s.amount !== null ? String(s.amount) : "",
    currency: s.currency ?? currencies[0] ?? "USD",
    billingCycle: (s.billingCycle ?? "MONTHLY") as BillingCycle,
    startDate:
      toDateInput(s.chargedAt) || new Date().toISOString().slice(0, 10),
    renewalDate: toDateInput(s.nextRenewalAt),
    categoryId: NONE,
    isTrial: false,
    trialEndsAt: "",
    notes: "",
  };
}

export function AcceptSuggestionDialog({
  suggestion,
  currencies,
  categories,
  onClose,
  onAccepted,
}: AcceptSuggestionDialogProps) {
  const t = useTranslations("receipts");
  const [form, setForm] = useState(() =>
    suggestion ? initialForm(suggestion, currencies) : null
  );
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!suggestion) return;
    setForm(initialForm(suggestion, currencies));
    setError(null);
    setSuggestedCategoryId(null);
    let cancelled = false;
    suggestCategory({
      serviceName: suggestion.matchedCatalog?.name ?? suggestion.vendorName,
      catalogCategory: suggestion.matchedCatalog?.category ?? null,
      vendorDomain: suggestion.senderEmail?.split("@")[1] ?? null,
    })
      .then((result) => {
        if (cancelled || !result.categoryId) return;
        setSuggestedCategoryId(result.categoryId);
        setForm((f) =>
          f && f.categoryId === NONE
            ? { ...f, categoryId: result.categoryId! }
            : f
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [suggestion, currencies]);

  if (!suggestion || !form) return null;

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const currencyOptions = Array.from(new Set([form.currency, ...currencies]));

  const submit = () => {
    const payload: AcceptReceiptSuggestionInput = {
      name: form.name,
      amount: Number(form.amount),
      currency: form.currency,
      billingCycle: form.billingCycle,
      startDate: form.startDate,
      renewalDate: form.renewalDate || null,
      categoryId: form.categoryId === NONE ? null : form.categoryId,
      isTrial: form.isTrial,
      trialEndsAt: form.isTrial && form.trialEndsAt ? form.trialEndsAt : null,
      notes: form.notes || null,
    };
    startTransition(async () => {
      const result = await acceptReceiptSuggestion(suggestion.id, payload);
      if (!result.success || !result.data) {
        setError(result.error ?? t("common.errors.generic"));
        return;
      }
      onAccepted(result.data.linked);
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("queue.accept.title")}</DialogTitle>
          <DialogDescription>{t("queue.accept.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Field label={t("queue.accept.name")} htmlFor="acc-name">
            <Input
              id="acc-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-[1fr_120px] gap-3">
            <Field label={t("queue.accept.amount")} htmlFor="acc-amount">
              <Input
                id="acc-amount"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
                className="tabular-nums"
              />
            </Field>
            <Field label={t("queue.accept.currency")} htmlFor="acc-currency">
              <Select
                value={form.currency}
                onValueChange={(v) => update("currency", v)}
              >
                <SelectTrigger id="acc-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("queue.accept.cycle")} htmlFor="acc-cycle">
              <Select
                value={form.billingCycle}
                onValueChange={(v) => update("billingCycle", v as BillingCycle)}
              >
                <SelectTrigger id="acc-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLE_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`common.cycles.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("queue.accept.startDate")} htmlFor="acc-start">
              <Input
                id="acc-start"
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </Field>
            <Field label={t("queue.accept.renewalDate")} htmlFor="acc-renewal">
              <Input
                id="acc-renewal"
                type="date"
                value={form.renewalDate}
                onChange={(e) => update("renewalDate", e.target.value)}
              />
            </Field>
          </div>

          <Field label={t("queue.accept.category")} htmlFor="acc-category">
            <Select
              value={form.categoryId}
              onValueChange={(v) => update("categoryId", v)}
            >
              <SelectTrigger id="acc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>
                  {t("queue.accept.noCategory")}
                </SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
                      {c.id === suggestedCategoryId && (
                        <span className="text-primary inline-flex items-center gap-0.5 text-xs font-medium">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          {t("queue.accept.suggestedCategory")}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 pt-6 text-sm">
              <Checkbox
                checked={form.isTrial}
                onCheckedChange={(v) => update("isTrial", v === true)}
              />
              {t("queue.accept.isTrial")}
            </label>
            {form.isTrial && (
              <Field label={t("queue.accept.trialEndsAt")} htmlFor="acc-trial">
                <Input
                  id="acc-trial"
                  type="date"
                  value={form.trialEndsAt}
                  onChange={(e) => update("trialEndsAt", e.target.value)}
                />
              </Field>
            )}
          </div>

          <Field label={t("queue.accept.notes")} htmlFor="acc-notes">
            <Textarea
              id="acc-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !form.name || !form.amount}
          >
            {isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            )}
            {isPending
              ? t("queue.accept.submitting")
              : t("queue.accept.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-xs font-medium tracking-wide uppercase"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
