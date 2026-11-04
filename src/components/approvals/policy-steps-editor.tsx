// src/components/approvals/policy-steps-editor.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ApprovalPolicyStepView,
  PolicyFormOptions,
} from "@/types/approval";
import type { ApprovalApproverType, UserRole } from "@prisma/client";
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { userLabel } from "./format";

const APPROVER_TYPES: ApprovalApproverType[] = [
  "MANAGER",
  "TEAM_APPROVER",
  "ROLE",
  "USER",
];
const MAX_STEPS = 10;

export type EditableStep = Omit<
  ApprovalPolicyStepView,
  "stepOrder" | "approverUser"
>;

interface Props {
  steps: EditableStep[];
  options: PolicyFormOptions;
  errors?: Record<string, string[]>;
  onChange: (steps: EditableStep[]) => void;
}

export function newStep(label = ""): EditableStep {
  return {
    label,
    approverType: "MANAGER",
    approverUserId: null,
    approverRole: null,
  };
}

export function PolicyStepsEditor({ steps, options, errors, onChange }: Props) {
  const t = useTranslations("approvals.policies.form");
  const tc = useTranslations("approvals.common");

  const update = (index: number, patch: Partial<EditableStep>) =>
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (index: number) =>
    onChange(steps.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          {t("steps")}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground h-3.5 w-3.5 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              {t("stepsHelp")}
            </TooltipContent>
          </Tooltip>
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...steps, newStep()])}
          disabled={steps.length >= MAX_STEPS}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("addStep")}
        </Button>
      </div>
      {errors?.steps?.[0] && (
        <p className="text-destructive text-xs">{errors.steps[0]}</p>
      )}
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const help =
            step.approverType === "MANAGER" ||
            step.approverType === "TEAM_APPROVER" ||
            step.approverType === "ROLE"
              ? t(`approverTypeHelp.${step.approverType}`)
              : null;
          return (
            <li
              key={index}
              className="border-border bg-muted/30 grid gap-2 rounded-md border p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-end"
            >
              <span className="bg-primary/10 text-primary mb-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                {index + 1}
              </span>
              <div className="space-y-1">
                <Label htmlFor={`step-${index}-label`} className="text-xs">
                  {t("stepLabel")}
                </Label>
                <Input
                  id={`step-${index}-label`}
                  value={step.label}
                  placeholder={t("stepLabelPlaceholder")}
                  onChange={(e) => update(index, { label: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-xs">
                  {t("approverType")}
                  {help && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="text-muted-foreground h-3 w-3 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {help}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Label>
                <Select
                  value={step.approverType}
                  onValueChange={(v) =>
                    update(index, {
                      approverType: v as ApprovalApproverType,
                      approverUserId: null,
                      approverRole: null,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`approverTypes.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                {step.approverType === "USER" ? (
                  <>
                    <Label className="text-xs">{t("selectUser")}</Label>
                    <Select
                      value={step.approverUserId ?? ""}
                      onValueChange={(v) =>
                        update(index, { approverUserId: v || null })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectUser")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {userLabel(u, tc("unknownUser"))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : step.approverType === "ROLE" ? (
                  <>
                    <Label className="text-xs">{t("selectRole")}</Label>
                    <Select
                      value={step.approverRole ?? ""}
                      onValueChange={(v) =>
                        update(index, {
                          approverRole: (v || null) as UserRole | null,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectRole")} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <p className="text-muted-foreground pb-2 text-xs">{help}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  aria-label="down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => remove(index)}
                  disabled={steps.length === 1}
                  aria-label={t("removeStep")}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
