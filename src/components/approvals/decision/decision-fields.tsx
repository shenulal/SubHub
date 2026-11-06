// src/components/approvals/decision/decision-fields.tsx
"use client";

/**
 * Inputs of the decision dialog. Approve: comment (required per setting),
 * conditions, cost centre / category (confirm or assign, single request only)
 * and the effective start date. Reject: reason from the master + comment.
 */
import { createCostCenter } from "@/actions/platform/masters/cost-centers";
import {
  FieldError,
  RequiredMark,
} from "@/components/common/quick-create/form-bits";
import { ManageMasterLink } from "@/components/common/quick-create/manage-master-link";
import { codeFromName } from "@/components/platform/masters/master-shared";
import { CategoryPicker } from "@/components/taxonomy/category-picker";
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
import type { DecisionFormOptions } from "@/types/approval";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DecisionDraft, DecisionTarget, FieldErrors } from "./types";
import { DECISION_OPTIONS_KEY } from "./use-decision-options";

interface FieldsProps {
  draft: DecisionDraft;
  onChange: (patch: Partial<DecisionDraft>) => void;
  errors: FieldErrors;
  disabled: boolean;
}

function CommentField({
  draft,
  onChange,
  errors,
  disabled,
  required,
  placeholder,
}: FieldsProps & { required: boolean; placeholder: string }) {
  const t = useTranslations("approvals.decision");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="decision-comment">
        {required ? t("comment") : t("commentOptional")}
        {required && <RequiredMark />}
      </Label>
      <Textarea
        id="decision-comment"
        rows={3}
        value={draft.comment}
        placeholder={placeholder}
        aria-invalid={Boolean(errors.comment)}
        onChange={(e) => onChange({ comment: e.target.value })}
        disabled={disabled}
      />
      <FieldError message={errors.comment} />
    </div>
  );
}

function CostCenterField({
  draft,
  onChange,
  disabled,
  options,
  missing,
}: FieldsProps & { options: DecisionFormOptions; missing: boolean }) {
  const t = useTranslations("approvals.decision");
  const queryClient = useQueryClient();
  const create = async (name: string) => {
    const res = await createCostCenter({ code: codeFromName(name), name });
    if (!res.success || !res.data) {
      toast.error(res.error ?? t("costCenterPlaceholder"));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: DECISION_OPTIONS_KEY });
    onChange({ costCenterId: res.data.id });
    toast.success(t("costCenterCreated", { name }));
  };
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor="decision-cost-center">{t("costCenter")}</Label>
      <Select
        value={draft.costCenterId ?? ""}
        onValueChange={(v) => onChange({ costCenterId: v || null })}
        disabled={disabled}
      >
        <SelectTrigger id="decision-cost-center" className="w-full">
          <SelectValue placeholder={t("costCenterPlaceholder")} />
        </SelectTrigger>
        <SelectContent
          createOption={
            options.canManageCostCenters
              ? {
                  label: (q) => t("createCostCenter", { name: q }),
                  onCreate: (q) => q && void create(q),
                }
              : undefined
          }
        >
          {options.costCenters.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.code} · {c.name}
            </SelectItem>
          ))}
          <ManageMasterLink
            href="/settings/masters?tab=cost-centers"
            label={t("manageCostCenters")}
            permission="masters:manage"
          />
        </SelectContent>
      </Select>
      {missing && (
        <p className="text-warning text-[0.8125rem]">
          {t("costCenterMissing")}
        </p>
      )}
    </div>
  );
}

export function ApproveFields({
  target,
  options,
  ...props
}: FieldsProps & { target: DecisionTarget; options: DecisionFormOptions }) {
  const t = useTranslations("approvals.decision");
  const single = target.ids.length === 1;
  const { draft, onChange, errors, disabled } = props;
  return (
    <div className="grid gap-4">
      <CommentField
        {...props}
        required={options.requireApproveComment}
        placeholder={t("commentPlaceholder")}
      />
      {single && (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="decision-conditions">{t("conditions")}</Label>
            <Textarea
              id="decision-conditions"
              rows={2}
              value={draft.conditions}
              placeholder={t("conditionsPlaceholder")}
              onChange={(e) => onChange({ conditions: e.target.value })}
              disabled={disabled}
            />
            <FieldError message={errors.conditions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CostCenterField
              {...props}
              options={options}
              missing={!target.costCenterId && !draft.costCenterId}
            />
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="decision-category">{t("category")}</Label>
              <CategoryPicker
                id="decision-category"
                value={draft.categoryId}
                onChange={(id) => onChange({ categoryId: id })}
                disabled={disabled}
              />
              {!target.categoryId && !draft.categoryId && (
                <p className="text-warning text-[0.8125rem]">
                  {t("categoryMissing")}
                </p>
              )}
              <FieldError message={errors.categoryId ?? errors.costCenterId} />
            </div>
          </div>
          <div className="grid gap-1.5 sm:max-w-[240px]">
            <Label htmlFor="decision-start">{t("effectiveStartDate")}</Label>
            <Input
              id="decision-start"
              type="date"
              value={draft.effectiveStartDate}
              onChange={(e) => onChange({ effectiveStartDate: e.target.value })}
              disabled={disabled}
            />
          </div>
          <p className="text-muted-foreground -mt-2 text-[0.8125rem]">
            {t("effectiveStartDateHint")}
          </p>
          <FieldError message={errors.effectiveStartDate} />
        </>
      )}
    </div>
  );
}

export function RejectFields({
  options,
  ...props
}: FieldsProps & { options: DecisionFormOptions }) {
  const t = useTranslations("approvals.decision");
  const { draft, onChange, errors, disabled } = props;
  const selected = options.reasons.find((r) => r.id === draft.reasonId);
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="decision-reason">
          {t("reason")}
          <RequiredMark />
        </Label>
        {options.reasons.length === 0 ? (
          <p className="tonal-warning rounded-md px-3 py-2 text-[0.8125rem]">
            {t("noReasons")}
          </p>
        ) : (
          <Select
            value={draft.reasonId ?? ""}
            onValueChange={(v) => onChange({ reasonId: v || null })}
            disabled={disabled}
          >
            <SelectTrigger
              id="decision-reason"
              className="w-full"
              aria-invalid={Boolean(errors.reasonId)}
            >
              <SelectValue placeholder={t("reasonPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {options.reasons.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
              <ManageMasterLink
                href="/settings/masters?tab=rejection-reasons"
                label={t("manageReasons")}
                permission="masters:manage"
              />
            </SelectContent>
          </Select>
        )}
        {selected?.description && (
          <p className="text-muted-foreground text-[0.8125rem]">
            {selected.description}
          </p>
        )}
        <FieldError message={errors.reasonId} />
      </div>
      <CommentField
        {...props}
        required
        placeholder={t("rejectCommentPlaceholder")}
      />
    </div>
  );
}

/** Request info / reply / cancel: one comment box (required per kind). */
export function CommentOnlyFields(
  props: FieldsProps & { required: boolean; placeholder: string }
) {
  return <CommentField {...props} />;
}
