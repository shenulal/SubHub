// src/components/subscriptions/subscription-form-pricing.tsx
"use client";

import { InviteMemberDialog } from "@/components/common/quick-create/invite-member-dialog";
import { ManageMasterLink } from "@/components/common/quick-create/manage-master-link";
import { CurrencyDialog } from "@/components/platform/masters/currency-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import type { UserOption } from "./subscription-form-assignment";
import type { SubscriptionFormValues } from "./subscription-form-schema";
import {
  getBillingCycleOptions,
  getBillingTypeOptions,
} from "./subscription-form.constants";

interface SubscriptionFormPricingProps {
  control: Control<SubscriptionFormValues>;
  register: UseFormRegister<SubscriptionFormValues>;
  setValue: UseFormSetValue<SubscriptionFormValues>;
  errors: FieldErrors<SubscriptionFormValues>;
  isPending: boolean;
  defaultCurrency: string;
  users: UserOption[];
  isAdmin: boolean;
  selectedUserIds: string[];
  /** Currency codes from `finance.enabledCurrencies`; falls back to the default currency. */
  currencyOptions?: string[];
  /** Enabled BillingCycleConfig rows; falls back to constants. */
  billingCycleOptions?: Array<{ value: string; label: string }>;
}

export function SubscriptionFormPricing({
  control,
  register,
  setValue,
  errors,
  isPending,
  defaultCurrency,
  users,
  isAdmin,
  selectedUserIds,
  currencyOptions,
  billingCycleOptions,
}: SubscriptionFormPricingProps) {
  const t = useTranslations();
  const cycleOptions = billingCycleOptions ?? getBillingCycleOptions(t);
  const ti = useTranslations("platform.masters.inline");
  const canCreateCurrency = usePermissionFlag("masters:manage_global");
  const canInvite = usePermissionFlag("members:invite");
  const tInline = useTranslations("shell.inline");
  const [inviteDraft, setInviteDraft] = useState<string | null>(null);
  const [createdCurrencies, setCreatedCurrencies] = useState<string[]>([]);
  const [newCurrency, setNewCurrency] = useState<string | null>(null);
  const watchedCurrency = useWatch({ control, name: "currency" });
  const currencyItems = Array.from(
    new Set([...(currencyOptions ?? [defaultCurrency]), ...createdCurrencies])
  )
    .filter(Boolean)
    .map((code) => ({ value: code, label: code }));
  const watchedBillingType = useWatch({ control, name: "billingType" });
  const watchedTotalLicenses = useWatch({ control, name: "totalLicenses" });

  const selectedUsersForSeat = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("subscriptions.form.pricing.title")}</CardTitle>
        <CardDescription>
          {t("subscriptions.form.pricing.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Billing cycle + pricing type */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billingCycle">
              {t("subscriptions.form.basicInfo.billingCycle")}
            </Label>
            <Controller
              control={control}
              name="billingCycle"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="billingCycle">
                    <SelectValue
                      placeholder={t(
                        "subscriptions.form.basicInfo.billingCyclePlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cycleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.billingCycle?.message && (
              <p className="text-destructive text-sm">
                {errors.billingCycle.message.toString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="billingType">
              {t("subscriptions.form.basicInfo.billingType")}
            </Label>
            <Controller
              control={control}
              name="billingType"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="billingType">
                    <SelectValue
                      placeholder={t(
                        "subscriptions.form.basicInfo.billingTypePlaceholder"
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {getBillingTypeOptions(t).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* PER_SEAT: seat management */}
        {watchedBillingType === "PER_SEAT" && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label htmlFor="totalLicenses">
                {t("subscriptions.form.license.totalSeats")}
              </Label>
              <Input
                id="totalLicenses"
                type="number"
                placeholder={t(
                  "subscriptions.form.license.totalSeatsPlaceholder"
                )}
                disabled={isPending}
                {...register("totalLicenses")}
              />
              {errors.totalLicenses?.message && (
                <p className="text-destructive text-sm">
                  {errors.totalLicenses.message.toString()}
                </p>
              )}
            </div>

            {isAdmin && users.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("subscriptions.form.license.assignUsers")}
                </Label>
                <MultiSelect
                  aria-label={t("subscriptions.form.license.assignUsers")}
                  options={users.map((user) => ({
                    value: user.id,
                    label: user.name ?? user.email,
                    keywords: [user.email],
                  }))}
                  value={selectedUserIds}
                  onValueChange={(next) => setValue("assignedUserIds", next)}
                  placeholder={t("subscriptions.form.license.selectUsers")}
                  searchPlaceholder={t(
                    "subscriptions.form.license.searchUsers"
                  )}
                  emptyText={t("subscriptions.form.license.noUsersFound")}
                  moreLabel={(count) => `+${count}`}
                  maxChips={3}
                  disabled={isPending}
                  createOption={
                    canInvite
                      ? {
                          label: (q) =>
                            q
                              ? tInline("inviteUser", { email: q })
                              : tInline("inviteUserEmpty"),
                          onCreate: (q) => setInviteDraft(q),
                        }
                      : undefined
                  }
                />
                <InviteMemberDialog
                  open={inviteDraft !== null}
                  onOpenChange={(o) => !o && setInviteDraft(null)}
                  defaultEmail={inviteDraft ?? ""}
                />

                <p className="text-muted-foreground text-sm">
                  {t("subscriptions.form.license.seatStatus", {
                    assigned: selectedUsersForSeat.length,
                    total: watchedTotalLicenses ?? "–",
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Currency + amount side by side */}
        <div className="grid grid-cols-[140px_1fr] gap-4">
          <div className="space-y-2">
            <Label htmlFor="currency">
              {t("subscriptions.form.basicInfo.currency")}
            </Label>
            <Select
              name="currency"
              value={watchedCurrency || defaultCurrency}
              onValueChange={(value) => setValue("currency", value)}
              disabled={isPending}
            >
              <SelectTrigger id="currency">
                <SelectValue
                  placeholder={t(
                    "subscriptions.form.basicInfo.currencyPlaceholder"
                  )}
                />
              </SelectTrigger>
              <SelectContent
                createOption={
                  canCreateCurrency
                    ? {
                        label: (q) =>
                          q ? ti("create", { name: q }) : ti("createEmpty"),
                        onCreate: (q) => setNewCurrency(q),
                      }
                    : undefined
                }
              >
                {currencyItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                <ManageMasterLink
                  href="/settings/masters?tab=currencies"
                  label={tInline("labels.currencies")}
                  permission="masters:manage_global"
                />
              </SelectContent>
            </Select>
            {newCurrency !== null && (
              <CurrencyDialog
                open
                onOpenChange={(o) => !o && setNewCurrency(null)}
                defaultCode={newCurrency}
                canEnable
                onSaved={(code) => {
                  setCreatedCurrencies((list) => [...list, code]);
                  setValue("currency", code);
                }}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              {t("subscriptions.form.basicInfo.amount")}
            </Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder={t("subscriptions.form.basicInfo.amountPlaceholder")}
              disabled={isPending}
              {...register("amount", {
                setValueAs: (v) => (v === "" ? "" : String(v)),
              })}
            />
            {errors.amount?.message && (
              <p className="text-destructive text-sm">
                {errors.amount.message.toString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
