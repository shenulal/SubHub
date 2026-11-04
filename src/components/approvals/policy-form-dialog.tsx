// src/components/approvals/policy-form-dialog.tsx
"use client";

/**
 * Feature 2.2 / 2.3 — policy builder dialog with contextual help tooltips.
 */
import { upsertApprovalPolicy } from "@/actions/approvals/policies";
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ApprovalPolicyView, PolicyFormOptions } from "@/types/approval";
import { Info, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  newStep,
  PolicyStepsEditor,
  type EditableStep,
} from "./policy-steps-editor";

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
  appliesToAll: boolean;
  costThreshold: string;
  costThresholdCurrency: string;
  categoryIds: string[];
  reminderAfterDays: string;
  escalationAfterDays: string;
  steps: EditableStep[];
}

function initialState(
  policy: ApprovalPolicyView | null,
  options: PolicyFormOptions
): FormState {
  return {
    name: policy?.name ?? "",
    description: policy?.description ?? "",
    isActive: policy?.isActive ?? true,
    appliesToAll: policy?.appliesToAll ?? false,
    costThreshold: policy?.costThreshold?.toString() ?? "",
    costThresholdCurrency:
      policy?.costThresholdCurrency ?? options.defaultCurrency,
    categoryIds: policy?.categoryIds ?? [],
    reminderAfterDays: policy?.reminderAfterDays?.toString() ?? "",
    escalationAfterDays: policy?.escalationAfterDays?.toString() ?? "",
    steps: policy?.steps.map((s) => ({
      id: s.id,
      label: s.label,
      approverType: s.approverType,
      approverUserId: s.approverUserId,
      approverRole: s.approverRole,
    })) ?? [newStep()],
  };
}

function HelpLabel({
  htmlFor,
  label,
  help,
}: {
  htmlFor?: string;
  label: string;
  help: string;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{help}</TooltipContent>
      </Tooltip>
    </Label>
  );
}

interface Props {
  open: boolean;
  policy: ApprovalPolicyView | null;
  options: PolicyFormOptions;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function PolicyFormDialog({
  open,
  policy,
  options,
  onOpenChange,
  onSaved,
}: Props) {
  const t = useTranslations("approvals.policies");
  const tf = useTranslations("approvals.policies.form");
  const tc = useTranslations("approvals.common");
  const [form, setForm] = useState<FormState>(() =>
    initialState(policy, options)
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setForm(initialState(policy, options));
      setErrors({});
    }
  }, [open, policy, options]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleCategory = (id: string) =>
    set(
      "categoryIds",
      form.categoryIds.includes(id)
        ? form.categoryIds.filter((c) => c !== id)
        : [...form.categoryIds, id]
    );

  const save = () => {
    startTransition(async () => {
      const res = await upsertApprovalPolicy({ id: policy?.id, ...form });
      if (!res.success) {
        setErrors(res.errors ?? {});
        toast.error(res.error ?? tc("errorGeneric"));
        return;
      }
      toast.success(t("saved"));
      onOpenChange(false);
      onSaved();
    });
  };

  const parents = options.categories.filter((c) => !c.parentId);

  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{policy ? t("edit") : t("new")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="policy-name">{tf("name")}</Label>
              <Input
                id="policy-name"
                value={form.name}
                placeholder={tf("namePlaceholder")}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name?.[0] && (
                <p className="text-destructive text-xs">{errors.name[0]}</p>
              )}
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                id="policy-active"
                checked={form.isActive}
                onCheckedChange={(v) => set("isActive", v)}
              />
              <Label htmlFor="policy-active">{tf("isActive")}</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy-description">{tf("description")}</Label>
            <Input
              id="policy-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <section className="border-border space-y-4 rounded-md border p-4">
            <p className="text-sm font-medium">{tf("rules")}</p>
            <div className="flex items-center gap-2">
              <Switch
                id="applies-all"
                checked={form.appliesToAll}
                onCheckedChange={(v) => set("appliesToAll", v)}
              />
              <HelpLabel
                htmlFor="applies-all"
                label={tf("appliesToAll")}
                help={tf("appliesToAllHelp")}
              />
            </div>
            {errors.appliesToAll?.[0] && (
              <p className="text-destructive text-xs">
                {errors.appliesToAll[0]}
              </p>
            )}
            {!form.appliesToAll && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <HelpLabel
                    htmlFor="threshold"
                    label={tf("threshold")}
                    help={tf("thresholdHelp")}
                  />
                  <div className="flex gap-2">
                    <Input
                      id="threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costThreshold}
                      onChange={(e) => set("costThreshold", e.target.value)}
                      className="flex-1"
                    />
                    <Select
                      value={form.costThresholdCurrency}
                      onValueChange={(v) => set("costThresholdCurrency", v)}
                    >
                      <SelectTrigger className="w-[100px]">
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
                  </div>
                </div>
                <div className="space-y-2">
                  <HelpLabel
                    label={tf("categories")}
                    help={tf("categoriesHelp")}
                  />
                  <div className="border-border max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
                    {parents.map((c) => (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={form.categoryIds.includes(c.id)}
                          onCheckedChange={() => toggleCategory(c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                    {parents.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        {tc("none")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="border-border grid gap-4 rounded-md border p-4 sm:grid-cols-2">
            <p className="text-sm font-medium sm:col-span-2">{tf("timing")}</p>
            <div className="space-y-2">
              <HelpLabel
                htmlFor="reminder-days"
                label={tf("reminderAfterDays")}
                help={tf("reminderHelp", {
                  default: options.defaultReminderAfterDays,
                })}
              />
              <div className="flex items-center gap-2">
                <Input
                  id="reminder-days"
                  type="number"
                  min="0"
                  value={form.reminderAfterDays}
                  placeholder={String(options.defaultReminderAfterDays)}
                  onChange={(e) => set("reminderAfterDays", e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">
                  {tf("days")}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <HelpLabel
                htmlFor="escalation-days"
                label={tf("escalationAfterDays")}
                help={tf("escalationHelp", {
                  default: options.defaultEscalationAfterDays,
                })}
              />
              <div className="flex items-center gap-2">
                <Input
                  id="escalation-days"
                  type="number"
                  min="0"
                  value={form.escalationAfterDays}
                  placeholder={String(options.defaultEscalationAfterDays)}
                  onChange={(e) => set("escalationAfterDays", e.target.value)}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">
                  {tf("days")}
                </span>
              </div>
            </div>
          </section>

          <PolicyStepsEditor
            steps={form.steps}
            options={options}
            errors={errors}
            onChange={(steps) => set("steps", steps)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPending ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
