"use client";

/**
 * Classification card: category, payment method, cost centre, tax rate,
 * tags and custom fields. Option lists come from master data via props.
 */
import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { CategoryPicker } from "@/components/taxonomy/category-picker";
import { CustomFieldsFields } from "@/components/taxonomy/custom-fields-form";
import { TagInput } from "@/components/taxonomy/tag-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { Controller, type Control } from "react-hook-form";
import type { SubscriptionFormValues } from "./subscription-form-schema";

interface SubscriptionFormClassificationProps {
  control: Control<SubscriptionFormValues>;
  isPending: boolean;
  options: Pick<
    SubscriptionFormOptions,
    "paymentMethods" | "costCenters" | "taxRates"
  >;
}

const NONE = "__none__";

interface MasterSelectProps {
  id: string;
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
  noneLabel: string;
  items: Array<{ id: string; label: string }>;
}

function MasterSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  noneLabel,
  items,
}: MasterSelectProps) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className="truncate">
        {label}
      </Label>
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(v === NONE ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue placeholder={noneLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SubscriptionFormClassification({
  control,
  isPending,
  options,
}: SubscriptionFormClassificationProps) {
  const t = useTranslations("lifecycle.form.classification");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("category")}</Label>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <CategoryPicker
                value={field.value || null}
                onChange={(id) => field.onChange(id ?? "")}
                disabled={isPending}
              />
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <Controller
            control={control}
            name="paymentMethodId"
            render={({ field }) => (
              <MasterSelect
                id="paymentMethodId"
                label={t("paymentMethod")}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                noneLabel={t("none")}
                items={options.paymentMethods.map((p) => ({
                  id: p.id,
                  label: p.name,
                }))}
              />
            )}
          />
          <Controller
            control={control}
            name="costCenterId"
            render={({ field }) => (
              <MasterSelect
                id="costCenterId"
                label={t("costCenter")}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                noneLabel={t("none")}
                items={options.costCenters.map((c) => ({
                  id: c.id,
                  label: `${c.code} · ${c.name}`,
                }))}
              />
            )}
          />
          <Controller
            control={control}
            name="taxRateId"
            render={({ field }) => (
              <MasterSelect
                id="taxRateId"
                label={t("taxRate")}
                value={field.value}
                onChange={field.onChange}
                disabled={isPending}
                noneLabel={t("none")}
                items={options.taxRates.map((r) => ({
                  id: r.id,
                  label: `${r.name} (${r.ratePercent}%)`,
                }))}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("tags")}</Label>
          <Controller
            control={control}
            name="tagNames"
            render={({ field }) => (
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("customFields")}</Label>
          <Controller
            control={control}
            name="customFields"
            render={({ field }) => (
              <CustomFieldsFields
                values={field.value ?? {}}
                onChange={field.onChange}
                disabled={isPending}
              />
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
