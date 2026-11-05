// src/components/subscriptions/subscription-filters-advanced.tsx
"use client";

/**
 * "More filters" popover: owner, team, cost centre, payment method, billing
 * cycle, amount range, renewal window, trial-only and archived toggle.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  SubscriptionFilterOptions,
  SubscriptionListFilter,
} from "@/types/discovery";
import type { BillingCycle } from "@prisma/client";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const CYCLES: BillingCycle[] = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"];
const ANY = "__any";

interface AdvancedFiltersProps {
  filter: SubscriptionListFilter;
  options: SubscriptionFilterOptions;
  onChange: (patch: Partial<SubscriptionListFilter>) => void;
  activeCount: number;
}

function toNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface SelectRowProps {
  id: string;
  label: string;
  value: string | undefined;
  options: Array<{ id: string; name: string }>;
  anyLabel: string;
  onChange: (value: string | undefined) => void;
}

function SelectRow({
  id,
  label,
  value,
  options,
  anyLabel,
  onChange,
}: SelectRowProps) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
      <Label htmlFor={id} className="text-muted-foreground text-xs">
        {label}
      </Label>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      >
        <SelectTrigger id={id} className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SubscriptionFiltersAdvanced({
  filter,
  options,
  onChange,
  activeCount,
}: AdvancedFiltersProps) {
  const t = useTranslations("discovery.filters");
  const tc = useTranslations("subscriptions.billingCycle");
  const [open, setOpen] = useState(false);

  const cycleLabel: Record<BillingCycle, string> = {
    MONTHLY: tc("monthly"),
    QUARTERLY: tc("quarterly"),
    YEARLY: tc("yearly"),
    ONE_TIME: tc("oneTime"),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-10 shrink-0 gap-2 border-dashed px-4 text-[0.9375rem] font-normal whitespace-nowrap",
            activeCount > 0 &&
              "border-primary/50 bg-primary/5 text-primary border-solid"
          )}
        >
          <SlidersHorizontal className="size-4" />
          {t("more")}
          {activeCount > 0 && (
            <span className="tonal-primary rounded-full px-1.5 text-[0.6875rem] font-medium">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] space-y-3 p-4">
        <SelectRow
          id="f-owner"
          label={t("owner")}
          value={filter.ownerId}
          options={options.owners}
          anyLabel={t("any")}
          onChange={(v) => onChange({ ownerId: v })}
        />
        <SelectRow
          id="f-team"
          label={t("team")}
          value={filter.teamId}
          options={options.teams}
          anyLabel={t("any")}
          onChange={(v) => onChange({ teamId: v })}
        />
        <SelectRow
          id="f-cost-centre"
          label={t("costCenter")}
          value={filter.costCenterId}
          options={options.costCenters}
          anyLabel={t("any")}
          onChange={(v) => onChange({ costCenterId: v })}
        />
        <SelectRow
          id="f-payment"
          label={t("paymentMethod")}
          value={filter.paymentMethodId}
          options={options.paymentMethods}
          anyLabel={t("any")}
          onChange={(v) => onChange({ paymentMethodId: v })}
        />
        <SelectRow
          id="f-cycle"
          label={t("billingCycle")}
          value={filter.billingCycle}
          options={CYCLES.map((c) => ({ id: c, name: cycleLabel[c] }))}
          anyLabel={t("any")}
          onChange={(v) => onChange({ billingCycle: v as BillingCycle })}
        />

        <div className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-2">
          <Label className="text-muted-foreground text-xs">{t("amount")}</Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("min")}
            aria-label={t("amountMin")}
            className="h-8 text-xs"
            value={filter.amountMin ?? ""}
            onChange={(e) => onChange({ amountMin: toNumber(e.target.value) })}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={t("max")}
            aria-label={t("amountMax")}
            className="h-8 text-xs"
            value={filter.amountMax ?? ""}
            onChange={(e) => onChange({ amountMax: toNumber(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
          <Label htmlFor="f-renewing" className="text-muted-foreground text-xs">
            {t("renewingWithin")}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="f-renewing"
              type="number"
              inputMode="numeric"
              min={1}
              className="h-8 w-24 text-xs"
              value={filter.renewingWithinDays ?? ""}
              onChange={(e) =>
                onChange({ renewingWithinDays: toNumber(e.target.value) })
              }
            />
            <span className="text-muted-foreground text-xs">{t("days")}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Label htmlFor="f-trial" className="text-xs">
            {t("trialOnly")}
          </Label>
          <Switch
            id="f-trial"
            checked={Boolean(filter.trialOnly)}
            onCheckedChange={(v) => onChange({ trialOnly: v || undefined })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="f-archived" className="text-xs">
            {t("includeArchived")}
          </Label>
          <Switch
            id="f-archived"
            checked={Boolean(filter.includeArchived)}
            onCheckedChange={(v) =>
              onChange({ includeArchived: v || undefined })
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
