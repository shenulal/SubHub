"use client";

/**
 * Trial, contract terms, reminders and ownership card.
 */
import type { SubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  computeCancellationDeadline,
  toIsoDate,
} from "@/lib/services/subscription/contract-terms";
import { useTranslations } from "next-intl";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import type { SubscriptionFormValues } from "./subscription-form-schema";

interface SubscriptionFormTermsProps {
  control: Control<SubscriptionFormValues>;
  register: UseFormRegister<SubscriptionFormValues>;
  errors: FieldErrors<SubscriptionFormValues>;
  isPending: boolean;
  options: Pick<
    SubscriptionFormOptions,
    "reminderLeadDayOptions" | "allowPersonalSubscriptions" | "owners"
  >;
}

function toggleInList(list: number[], value: number): number[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value].sort((a, b) => b - a);
}

export function SubscriptionFormTerms({
  control,
  register,
  errors,
  isPending,
  options,
}: SubscriptionFormTermsProps) {
  const t = useTranslations("lifecycle.form.terms");
  const isTrial = useWatch({ control, name: "isTrial" });
  const endDate = useWatch({ control, name: "endDate" });
  const noticePeriodDays = useWatch({ control, name: "noticePeriodDays" });
  const noticeValue =
    noticePeriodDays == null || String(noticePeriodDays) === ""
      ? null
      : Number(noticePeriodDays);
  const deadline = computeCancellationDeadline({
    endDate: endDate || null,
    noticePeriodDays: Number.isFinite(noticeValue) ? noticeValue : null,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Trial */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="isTrial">{t("isTrial")}</Label>
            <Controller
              control={control}
              name="isTrial"
              render={({ field }) => (
                <Switch
                  id="isTrial"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </div>
          {isTrial && (
            <div className="space-y-2">
              <Label htmlFor="trialEndsAt">{t("trialEndsAt")}</Label>
              <Input
                id="trialEndsAt"
                type="date"
                disabled={isPending}
                {...register("trialEndsAt")}
              />
            </div>
          )}
        </div>

        {/* Notice period + deadline preview */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="noticePeriodDays">{t("noticePeriodDays")}</Label>
            <Input
              id="noticePeriodDays"
              type="number"
              min={0}
              disabled={isPending}
              {...register("noticePeriodDays")}
            />
            {errors.noticePeriodDays?.message && (
              <p className="text-destructive text-sm">
                {errors.noticePeriodDays.message.toString()}
              </p>
            )}
          </div>
          <div className="bg-muted/40 flex items-center rounded-md border px-3 py-2 text-sm">
            {deadline
              ? t("deadlinePreview", { date: toIsoDate(deadline) })
              : t("deadlinePreviewEmpty")}
          </div>
        </div>

        {/* Reminder lead days */}
        <div className="space-y-2">
          <Label>{t("reminderLeadDays")}</Label>
          <Controller
            control={control}
            name="reminderLeadDays"
            render={({ field }) => (
              <div className="flex flex-wrap gap-3">
                {options.reminderLeadDayOptions.map((lead) => {
                  const checked = (field.value ?? []).includes(lead);
                  return (
                    <label
                      key={lead}
                      className="has-[:checked]:border-primary flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isPending}
                        onCheckedChange={() =>
                          field.onChange(toggleInList(field.value ?? [], lead))
                        }
                      />
                      {t("reminderLeadOption", { days: lead })}
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>

        {/* Ownership */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ownerId">{t("owner")}</Label>
            <Controller
              control={control}
              name="ownerId"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="ownerId">
                    <SelectValue placeholder={t("ownerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name ?? owner.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {options.allowPersonalSubscriptions && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="space-y-0.5">
                <Label htmlFor="isPersonal">{t("personal")}</Label>
                <p className="text-muted-foreground text-xs">
                  {t("personalHint")}
                </p>
              </div>
              <Controller
                control={control}
                name="isPersonal"
                render={({ field }) => (
                  <Switch
                    id="isPersonal"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Cancellation overrides */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cancellationUrl">{t("cancellationUrl")}</Label>
            <Input
              id="cancellationUrl"
              type="url"
              placeholder="https://"
              disabled={isPending}
              {...register("cancellationUrl")}
            />
            {errors.cancellationUrl?.message && (
              <p className="text-destructive text-sm">
                {errors.cancellationUrl.message.toString()}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationNotes">{t("cancellationNotes")}</Label>
            <Textarea
              id="cancellationNotes"
              rows={2}
              disabled={isPending}
              {...register("cancellationNotes")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
