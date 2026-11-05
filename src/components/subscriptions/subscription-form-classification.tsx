"use client";

/**
 * Classification card: category, payment method, cost centre, tax rate,
 * tags and custom fields. Option lists come from master data via props.
 */
import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { CostCenterDialog } from "@/components/platform/masters/cost-center-dialog";
import { PaymentMethodDialog } from "@/components/platform/masters/payment-method-dialog";
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
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import { useTranslations } from "next-intl";
import { useState } from "react";
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
  /** Inline "+ Create …" row (only passed when the user may manage masters). */
  onCreate?: (query: string) => void;
}

type MasterItem = { id: string; label: string };
type CreateTarget = { kind: "paymentMethod" | "costCenter"; name: string };

function MasterSelect({
  id,
  label,
  value,
  onChange,
  disabled,
  noneLabel,
  items,
  onCreate,
}: MasterSelectProps) {
  const ti = useTranslations("platform.masters.inline");
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
        <SelectContent
          createOption={
            onCreate
              ? {
                  label: (q) =>
                    q ? ti("create", { name: q }) : ti("createEmpty"),
                  onCreate,
                }
              : undefined
          }
        >
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
  const canManageMasters = usePermissionFlag("masters:manage");
  const [createdMethods, setCreatedMethods] = useState<MasterItem[]>([]);
  const [createdCenters, setCreatedCenters] = useState<MasterItem[]>([]);
  const [creating, setCreating] = useState<CreateTarget | null>(null);
  const startCreate = (kind: CreateTarget["kind"]) =>
    canManageMasters
      ? (name: string) => setCreating({ kind, name })
      : undefined;
  const paymentMethodItems = [
    ...options.paymentMethods.map((p) => ({ id: p.id, label: p.name })),
    ...createdMethods,
  ];
  const costCenterItems = [
    ...options.costCenters.map((c) => ({
      id: c.id,
      label: `${c.code} · ${c.name}`,
    })),
    ...createdCenters,
  ];

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
              <>
                <MasterSelect
                  id="paymentMethodId"
                  label={t("paymentMethod")}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                  noneLabel={t("none")}
                  items={paymentMethodItems}
                  onCreate={startCreate("paymentMethod")}
                />
                {creating?.kind === "paymentMethod" && (
                  <PaymentMethodDialog
                    open
                    onOpenChange={(o) => !o && setCreating(null)}
                    defaultName={creating.name}
                    onSaved={({ id, name }) => {
                      setCreatedMethods((list) => [
                        ...list,
                        { id, label: name },
                      ]);
                      field.onChange(id);
                    }}
                  />
                )}
              </>
            )}
          />
          <Controller
            control={control}
            name="costCenterId"
            render={({ field }) => (
              <>
                <MasterSelect
                  id="costCenterId"
                  label={t("costCenter")}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isPending}
                  noneLabel={t("none")}
                  items={costCenterItems}
                  onCreate={startCreate("costCenter")}
                />
                {creating?.kind === "costCenter" && (
                  <CostCenterDialog
                    open
                    onOpenChange={(o) => !o && setCreating(null)}
                    defaultName={creating.name}
                    onSaved={({ id, code, name }) => {
                      setCreatedCenters((list) => [
                        ...list,
                        { id, label: `${code} · ${name}` },
                      ]);
                      field.onChange(id);
                    }}
                  />
                )}
              </>
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
