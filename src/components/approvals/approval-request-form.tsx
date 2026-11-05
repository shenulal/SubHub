// src/components/approvals/approval-request-form.tsx
"use client";

/**
 * Feature 2.1 — new approval request form.
 */
import { submitApprovalRequest } from "@/actions/approvals/submit";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ApprovalFormOptions, CatalogSuggestion } from "@/types/approval";
import { Loader2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryPicker } from "./category-picker";
import { formatMoney } from "./format";
import { ServiceNameAutocomplete } from "./service-name-autocomplete";

interface FormState {
  serviceName: string;
  catalogId: string | null;
  vendorWebsite: string;
  amount: string;
  currency: string;
  billingCycle: string;
  seats: string;
  categoryId: string | null;
  costCenterId: string | null;
  justification: string;
}

type FieldErrors = Partial<Record<keyof FormState, string[]>>;

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function ApprovalRequestForm({
  options,
}: {
  options: ApprovalFormOptions;
}) {
  const t = useTranslations("approvals.form");
  const tCycle = useTranslations("approvals.cycle");
  const tc = useTranslations("approvals.common");
  const tRoot = useTranslations("approvals");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<FormState>({
    serviceName: "",
    catalogId: null,
    vendorWebsite: "",
    amount: "",
    currency: options.defaultCurrency,
    billingCycle: options.cycles[0]?.cycle ?? "MONTHLY",
    seats: "",
    categoryId: null,
    costCenterId: null,
    justification: "",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const months =
    options.cycles.find((c) => c.cycle === form.billingCycle)?.months ?? 1;
  const monthly = useMemo(() => {
    const amount = Number(form.amount);
    if (!amount || months <= 0) return null;
    return amount / months;
  }, [form.amount, months]);

  const onCatalogSelect = (item: CatalogSuggestion) => {
    setForm((prev) => ({
      ...prev,
      serviceName: item.name,
      catalogId: item.id,
      vendorWebsite: prev.vendorWebsite || item.website || "",
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await submitApprovalRequest(form);
      if (!res.success) {
        setErrors((res.errors ?? {}) as FieldErrors);
        toast.error(res.error ?? t("errors.fix"));
        return;
      }
      toast.success(
        res.data?.autoApproved ? t("successAutoApproved") : t("successPending")
      );
      router.push(`/approvals/${res.data?.id}`);
    });
  };

  const justificationCount = form.justification.trim().length;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader title={t("title")} backHref="/approvals" showBack />
      <p className="text-muted-foreground -mt-4 max-w-2xl text-[0.9375rem]">
        {t("description")}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionService")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label={t("serviceName")}
                  htmlFor="serviceName"
                  hint={t("serviceNameHint")}
                  error={errors.serviceName?.[0]}
                >
                  <ServiceNameAutocomplete
                    id="serviceName"
                    value={form.serviceName}
                    placeholder={t("serviceNamePlaceholder")}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        serviceName: v,
                        catalogId: null,
                      }))
                    }
                    onSelect={onCatalogSelect}
                    aria-invalid={Boolean(errors.serviceName)}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label={`${t("vendorWebsite")} · ${tc("optional")}`}
                  htmlFor="vendorWebsite"
                  error={errors.vendorWebsite?.[0]}
                >
                  <Input
                    id="vendorWebsite"
                    type="url"
                    placeholder="https://"
                    value={form.vendorWebsite}
                    onChange={(e) => set("vendorWebsite", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionCost")}</CardTitle>
              {monthly !== null && (
                <CardDescription className="tabular-nums">
                  {t("monthlyEquivalent", {
                    amount: formatMoney(monthly, form.currency),
                  })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Field
                  label={t("amount")}
                  htmlFor="amount"
                  error={errors.amount?.[0]}
                >
                  <Input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    aria-invalid={Boolean(errors.amount)}
                  />
                </Field>
              </div>
              <Field
                label={t("currency")}
                htmlFor="currency"
                error={errors.currency?.[0]}
              >
                <Select
                  value={form.currency}
                  onValueChange={(v) => set("currency", v)}
                >
                  <SelectTrigger id="currency">
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
              <Field
                label={t("billingCycle")}
                htmlFor="billingCycle"
                error={errors.billingCycle?.[0]}
              >
                <Select
                  value={form.billingCycle}
                  onValueChange={(v) => set("billingCycle", v)}
                >
                  <SelectTrigger id="billingCycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.cycles.map((c) => (
                      <SelectItem key={c.cycle} value={c.cycle}>
                        {c.label || tCycle(c.cycle)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label={`${t("seats")} · ${tc("optional")}`}
                  htmlFor="seats"
                  error={errors.seats?.[0]}
                >
                  <Input
                    id="seats"
                    type="number"
                    min="1"
                    step="1"
                    value={form.seats}
                    onChange={(e) => set("seats", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionContext")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CategoryPicker
                categories={options.categories}
                value={form.categoryId}
                onChange={(id) => set("categoryId", id)}
                error={errors.categoryId?.[0]}
              />
              <Field
                label={`${t("costCenter")} · ${tc("optional")}`}
                htmlFor="costCenter"
                error={errors.costCenterId?.[0]}
              >
                <Select
                  value={form.costCenterId ?? ""}
                  onValueChange={(v) => set("costCenterId", v || null)}
                >
                  <SelectTrigger id="costCenter">
                    <SelectValue placeholder={t("selectCostCenter")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.costCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.code} · {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={t("justification")}
                htmlFor="justification"
                hint={t("justificationHint", {
                  min: options.justificationMinLength,
                  count: justificationCount,
                })}
                error={errors.justification?.[0]}
              >
                <Textarea
                  id="justification"
                  rows={5}
                  placeholder={t("justificationPlaceholder")}
                  value={form.justification}
                  onChange={(e) => set("justification", e.target.value)}
                  aria-invalid={Boolean(errors.justification)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
                  <Send className="size-5" aria-hidden="true" />
                </span>
                <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
                  {t("sectionCost")}
                </p>
              </div>
              <p className="text-foreground truncate text-3xl font-medium tabular-nums">
                {monthly !== null ? formatMoney(monthly, form.currency) : "—"}
                <span className="text-muted-foreground ml-1 text-sm font-normal">
                  {tRoot("perMonth")}
                </span>
              </p>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isPending ? t("submitting") : t("submit")}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </form>
  );
}
