// src/components/taxonomy/custom-fields-form.tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { getCustomFieldDefinitions } from "@/actions/taxonomy/custom-fields";
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
import {
  parseMultiSelectValue,
  serializeMultiSelectValue,
} from "@/lib/services/taxonomy/custom-field-options";
import { validateCustomFieldValues } from "@/lib/services/taxonomy/custom-field-validation";
import { cn } from "@/lib/utils";
import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

export interface CustomFieldsFieldsProps {
  /** Values keyed by field definition id. */
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** Pre-loaded definitions; fetched when omitted. */
  definitions?: CustomFieldDefinitionDto[];
  /** Server-side errors (error keys from the validator) keyed by field id. */
  errors?: Record<string, string>;
  disabled?: boolean;
  className?: string;
}

interface FieldProps {
  def: CustomFieldDefinitionDto;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function FieldControl({
  def,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: FieldProps) {
  const t = useTranslations("taxonomy.customFields");
  const id = useId();
  const describedBy = error ? `${id}-error` : undefined;
  const inputType =
    def.fieldType === "NUMBER"
      ? "number"
      : def.fieldType === "DATE"
        ? "date"
        : "text";

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {def.label}
        {def.isRequired && (
          <span
            className="text-destructive text-xs"
            aria-label={t("requiredMarker")}
          >
            *
          </span>
        )}
      </Label>
      {def.fieldType === "MULTI_SELECT" ? (
        <MultiSelect
          id={id}
          aria-label={def.label}
          aria-invalid={Boolean(error)}
          options={(def.options ?? []).map((opt) => ({
            value: opt,
            label: opt,
          }))}
          value={parseMultiSelectValue(value)}
          onValueChange={(picked) => {
            onChange(serializeMultiSelectValue(picked));
            onBlur();
          }}
          disabled={disabled}
          placeholder={t("multiSelectPlaceholder")}
          searchPlaceholder={t("searchOptions")}
          emptyText={t("noOptions")}
          maxChips={3}
        />
      ) : def.fieldType === "SELECT" ? (
        <Select
          value={value || undefined}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={id}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="w-full"
          >
            <SelectValue placeholder={t("selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={inputType}
          value={value}
          disabled={disabled}
          required={def.isRequired}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          inputMode={def.fieldType === "NUMBER" ? "decimal" : undefined}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}

/** Renders one input per custom-field definition with inline validation. */
export function CustomFieldsFields({
  values,
  onChange,
  definitions,
  errors,
  disabled,
  className,
}: CustomFieldsFieldsProps) {
  const [defs, setDefs] = useState<CustomFieldDefinitionDto[]>(
    definitions ?? []
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (definitions) {
      setDefs(definitions);
      return;
    }
    let cancelled = false;
    getCustomFieldDefinitions().then((d) => {
      if (!cancelled) setDefs(d);
    });
    return () => {
      cancelled = true;
    };
  }, [definitions]);

  const active = defs.filter((d) => !d.isArchived);
  if (active.length === 0) return null;

  const local = validateCustomFieldValues(active, values).errors;
  const errorFor = (id: string) =>
    errors?.[id] ?? (touched[id] ? local[id] : undefined);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {active.map((def) => (
        <FieldControl
          key={def.id}
          def={def}
          value={values[def.id] ?? ""}
          error={errorFor(def.id)}
          disabled={disabled}
          onChange={(v) => onChange({ ...values, [def.id]: v })}
          onBlur={() => setTouched((prev) => ({ ...prev, [def.id]: true }))}
        />
      ))}
    </div>
  );
}
