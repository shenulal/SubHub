"use client";

import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_BASE_CURRENCY } from "@/lib/fx/convert";
import {
  suggestRenewalDate,
  toIsoDate,
} from "@/lib/services/subscription/contract-terms";
import type { SubscriptionDetail } from "@/types/subscription";
import { zodResolver } from "@hookform/resolvers/zod";
import { type HttpError } from "@refinedev/core";
import { useForm } from "@refinedev/react-hook-form";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { FormActionBar, focusFirstInvalid } from "./form-action-bar";
import {
  SubscriptionFormAssignment,
  type AppWithTeams,
  type UserOption,
} from "./subscription-form-assignment";
import { SubscriptionFormClassification } from "./subscription-form-classification";
import { SubscriptionFormPeriod } from "./subscription-form-period";
import { SubscriptionFormPricing } from "./subscription-form-pricing";
import { SubscriptionFormRenewal } from "./subscription-form-renewal";
import {
  createSubscriptionFormSchema,
  type SubscriptionFormValues,
} from "./subscription-form-schema";
import { SubscriptionFormTerms } from "./subscription-form-terms";
import { SubscriptionFormVendor } from "./subscription-form-vendor";
import { formatDateForInput } from "./subscription-form.constants";

interface SubscriptionFormProps {
  apps: AppWithTeams[];
  users?: UserOption[];
  isAdmin?: boolean;
  subscription?: SubscriptionDetail;
  hideActions?: boolean;
  formId?: string;
  onPendingChange?: (isPending: boolean) => void;
  initialAmount?: string;
  onSuccess?: (createdSubscriptionId?: string) => void;
  /** Settings-driven option lists; omitted in legacy callers/tests. */
  options?: SubscriptionFormOptions;
}

const DEFAULT_CYCLE_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
  ONE_TIME: 0,
};

function buildDefaults(
  subscription: SubscriptionDetail | undefined,
  options: SubscriptionFormOptions | undefined,
  initialAmount: string | undefined
): SubscriptionFormValues {
  return {
    appId: subscription?.appId ?? "",
    appName: subscription?.appName ?? "",
    catalogId: subscription?.app?.catalogId ?? "",
    appWebsite: subscription?.app?.website ?? "",
    appLogoUrl: subscription?.appLogoUrl ?? "",
    billingCycle:
      subscription?.billingCycle ?? options?.defaultBillingCycle ?? "MONTHLY",
    billingType: subscription?.billingType ?? "FLAT_RATE",
    amount: subscription ? String(subscription.amount) : (initialAmount ?? ""),
    currency:
      subscription?.currency ?? options?.baseCurrency ?? DEFAULT_BASE_CURRENCY,
    totalLicenses: subscription?.totalLicenses ?? undefined,
    usedLicenses: subscription?.usedLicenses ?? undefined,
    startDate: subscription ? formatDateForInput(subscription.startDate) : "",
    endDate: subscription ? formatDateForInput(subscription.endDate) : "",
    renewalDate: subscription
      ? formatDateForInput(subscription.renewalDate)
      : "",
    autoRenewal: subscription?.autoRenewal ?? true,
    renewalAlert30: subscription?.renewalAlert30 ?? true,
    renewalAlert60: subscription?.renewalAlert60 ?? false,
    renewalAlert90: subscription?.renewalAlert90 ?? false,
    contractUrl: subscription?.contractUrl ?? "",
    notes: subscription?.notes ?? "",
    status: subscription?.status ?? "ACTIVE",
    teamId: subscription?.teamId ?? null,
    teamIds:
      subscription?.teams?.map((team) => team.id) ??
      (subscription?.teamId ? [subscription.teamId] : []),
    assignedUserIds: subscription?.assignedUsers?.map((u) => u.id) ?? [],
    categoryId: subscription?.category?.id ?? "",
    paymentMethodId:
      subscription?.paymentMethod?.id ??
      options?.paymentMethods.find((p) => p.isDefault)?.id ??
      "",
    costCenterId: subscription?.costCenter?.id ?? "",
    taxRateId:
      subscription?.taxRate?.id ??
      options?.taxRates.find((r) => r.isDefault)?.id ??
      "",
    tagNames: subscription?.tags?.map((tag) => tag.name) ?? [],
    customFields: Object.fromEntries(
      (subscription?.customFieldValues ?? []).map((cfv) => [
        cfv.fieldId,
        cfv.value,
      ])
    ),
    isTrial: subscription?.isTrial ?? false,
    trialEndsAt: subscription
      ? formatDateForInput(subscription.trialEndsAt)
      : "",
    noticePeriodDays:
      subscription?.noticePeriodDays ??
      options?.defaultNoticePeriodDays ??
      null,
    reminderLeadDays:
      subscription?.reminderLeadDays ?? options?.defaultReminderLeadDays ?? [],
    isPersonal: subscription?.isPersonal ?? false,
    ownerId: subscription?.owner?.id ?? options?.currentUserId ?? "",
    cancellationUrl: subscription?.cancellationUrl ?? "",
    cancellationNotes: subscription?.cancellationNotes ?? "",
  };
}

export function SubscriptionForm({
  apps,
  users = [],
  isAdmin = false,
  subscription,
  hideActions = false,
  formId,
  onPendingChange,
  initialAmount,
  onSuccess,
  options,
}: SubscriptionFormProps) {
  const t = useTranslations();
  const tl = useTranslations("lifecycle.form");
  const tShell = useTranslations("shell.form");
  const router = useRouter();
  const isEditing = !!subscription;

  const subscriptionFormSchema = useMemo(
    () => createSubscriptionFormSchema(t),
    [t]
  );
  const defaultValues = useMemo(
    () => buildDefaults(subscription, options, initialAmount),
    [subscription, options, initialAmount]
  );

  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    register,
    control,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormValues, HttpError, SubscriptionFormValues>({
    refineCoreProps: {
      resource: "subscriptions",
      action: isEditing ? "edit" : "create",
      id: subscription?.id,
      redirect: false,
    },
    resolver: zodResolver(
      subscriptionFormSchema
    ) as unknown as Resolver<SubscriptionFormValues>,
    defaultValues,
  });

  const isPending = formLoading || isSubmitting;

  // Apps and teams created inline join the option lists without a reload.
  const [createdApps, setCreatedApps] = useState<AppWithTeams[]>([]);
  const allApps = useMemo(() => [...apps, ...createdApps], [apps, createdApps]);
  const addCreatedApp = useCallback(
    (app: { id: string; name: string; logoUrl?: string | null }) =>
      setCreatedApps((prev) => [
        ...prev,
        { id: app.id, name: app.name, teams: [], logoUrl: app.logoUrl },
      ]),
    []
  );
  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const watchedBillingType = useWatch({ control, name: "billingType" });
  const watchedUserIds = useWatch({ control, name: "assignedUserIds" });
  const selectedUserIds = useMemo(() => watchedUserIds ?? [], [watchedUserIds]);

  // PER_SEAT: assigned users drive usedLicenses
  useEffect(() => {
    if (watchedBillingType === "PER_SEAT" && selectedUserIds.length > 0) {
      setValue("usedLicenses", selectedUserIds.length);
    }
  }, [watchedBillingType, selectedUserIds.length, setValue]);

  const cycleMonths = useMemo(() => {
    const map: Record<string, number> = { ...DEFAULT_CYCLE_MONTHS };
    for (const row of options?.billingCycles ?? []) map[row.cycle] = row.months;
    return map;
  }, [options]);

  const suggestRenewal = () => {
    const values = getValues?.() ?? defaultValues;
    const suggested = suggestRenewalDate(
      values.startDate,
      cycleMonths[values.billingCycle] ?? 0
    );
    if (suggested)
      setValue("renewalDate", toIsoDate(suggested), { shouldDirty: true });
  };

  const handleCancel = () => router.back();

  const onSubmit = handleSubmit(
    async (values) => {
      const payload = {
        ...values,
        totalLicenses: values.totalLicenses ?? undefined,
        usedLicenses: values.usedLicenses ?? undefined,
        endDate: values.endDate || undefined,
        renewalDate: values.renewalDate || undefined,
        trialEndsAt: values.trialEndsAt || undefined,
        noticePeriodDays:
          values.noticePeriodDays == null ||
          Number.isNaN(values.noticePeriodDays)
            ? undefined
            : values.noticePeriodDays,
      };
      try {
        const result = await onFinish(payload);
        const id =
          (result?.data as { id?: string })?.id ??
          (result?.data as { data?: { id?: string } })?.data?.id ??
          subscription?.id;
        toast.success(
          isEditing
            ? t("subscriptions.actions.saveSuccess")
            : t("subscriptions.actions.createSuccess")
        );
        if (onSuccess) {
          onSuccess(id);
          return;
        }
        router.push(id ? `/subscriptions/${id}` : "/subscriptions");
      } catch (error) {
        const message =
          (error as { message?: string; error?: string })?.error ??
          (error instanceof Error ? error.message : undefined);
        toast.error(
          message ||
            (isEditing
              ? t("subscriptions.actions.saveError")
              : t("subscriptions.actions.createError"))
        );
      }
    },
    (validationErrors) => {
      const firstKey = focusFirstInvalid(Object.keys(validationErrors));
      const firstError =
        validationErrors[firstKey as keyof typeof validationErrors];
      const message =
        firstError && "message" in firstError
          ? String(firstError.message)
          : t("subscriptions.actions.saveError");
      toast.error(message, { description: tShell("fixErrors") });
    }
  );

  return (
    <form onSubmit={onSubmit} id={formId}>
      <div className="space-y-6">
        <SubscriptionFormVendor
          control={control}
          setValue={setValue}
          errors={errors}
          isPending={isPending}
          isEditing={isEditing}
          excludeId={subscription?.id}
          apps={allApps}
          onAppCreated={addCreatedApp}
        />

        <SubscriptionFormPricing
          control={control}
          register={register}
          setValue={setValue}
          errors={errors}
          isPending={isPending}
          defaultCurrency={defaultValues.currency}
          users={users}
          isAdmin={isAdmin}
          selectedUserIds={selectedUserIds}
          currencyOptions={options?.currencies}
          billingCycleOptions={options?.billingCycles.map((c) => ({
            value: c.cycle,
            label: c.label,
          }))}
        />

        <SubscriptionFormPeriod
          control={control}
          errors={errors}
          isPending={isPending}
          onSuggestRenewal={suggestRenewal}
          suggestRenewalLabel={tl("terms.suggestRenewal")}
        />

        {options && (
          <SubscriptionFormClassification
            control={control}
            isPending={isPending}
            options={options}
          />
        )}

        <SubscriptionFormAssignment
          control={control}
          apps={allApps}
          users={users}
          isAdmin={isAdmin}
          isPending={isPending}
          billingType={watchedBillingType}
          setValue={(name, value) =>
            setValue(name, value as SubscriptionFormValues[typeof name])
          }
        />

        <SubscriptionFormRenewal control={control} isPending={isPending} />

        {options && (
          <SubscriptionFormTerms
            control={control}
            register={register}
            errors={errors}
            isPending={isPending}
            options={options}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("subscriptions.form.basicInfo.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Textarea
                id="notes"
                placeholder={t("subscriptions.form.basicInfo.notesPlaceholder")}
                rows={4}
                disabled={isPending}
                {...register("notes")}
              />
              {errors.notes?.message && (
                <p className="text-destructive text-sm">
                  {errors.notes.message.toString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {!hideActions && (
        <FormActionBar
          hint={tShell("requiredHint")}
          cancelLabel={t("subscriptions.actions.cancel")}
          submitLabel={
            isEditing
              ? t("subscriptions.actions.save")
              : t("subscriptions.actions.register")
          }
          isPending={isPending}
          onCancel={handleCancel}
        />
      )}
    </form>
  );
}
