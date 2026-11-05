"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  SECRET_UNCHANGED,
  type SerializedSettingDefinition,
} from "@/types/platform";
import { Info, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChipInput } from "./chip-input";

interface SettingFieldProps {
  definition: SerializedSettingDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  onReset: () => void;
  disabled?: boolean;
  isDirty?: boolean;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function SecretInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("platform.settings");
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={typeof value === "string" ? value : ""}
          readOnly
          disabled
          className="min-w-0 flex-1 font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={disabled}
          onClick={() => {
            setEditing(true);
            onChange("");
          }}
        >
          {t("changeSecret")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 font-mono"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => {
          setEditing(false);
          onChange(SECRET_UNCHANGED);
        }}
      >
        {t("cancel")}
      </Button>
    </div>
  );
}

/**
 * `multiselect` setting: searchable multi-select (shared MultiSelect).
 * Values outside the option list are kept so a saved value is never lost.
 */
function SettingMultiSelect({
  id,
  definition,
  value,
  onChange,
  disabled,
}: {
  id: string;
  definition: SerializedSettingDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("platform.settings");
  const selected = asStringArray(value);
  const options = definition.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const unknown = selected.filter((v) => !known.has(v));
  return (
    <MultiSelect
      id={id}
      aria-label={definition.label}
      options={[
        ...options.map((o) => ({ value: o.value, label: o.label })),
        ...unknown.map((v) => ({ value: v, label: v })),
      ]}
      value={selected}
      onValueChange={onChange}
      disabled={disabled}
      placeholder={t("multiSelectPlaceholder")}
      searchPlaceholder={t("searchOptions")}
      emptyText={t("noOptions")}
      selectAllLabel={t("selectAll")}
      clearLabel={t("clearSelection")}
      maxChips={3}
      className="w-full"
    />
  );
}

function FieldControl({
  definition,
  value,
  onChange,
  disabled,
}: Omit<SettingFieldProps, "onReset" | "isDirty">) {
  const t = useTranslations("platform.settings");
  const id = `setting-${definition.key}`;
  switch (definition.input) {
    case "boolean":
      return (
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      );
    case "number":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={definition.min}
            max={definition.max}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={disabled}
            className="min-w-0 flex-1 font-mono"
          />
          {definition.unit && (
            <span className="text-muted-foreground shrink-0 text-[0.8125rem]">
              {definition.unit}
            </span>
          )}
        </div>
      );
    case "select":
      return (
        <Select
          value={value === null || value === undefined ? "" : String(value)}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            id={id}
            className="w-full min-w-0 [&>span]:block [&>span]:min-w-0 [&>span]:truncate"
          >
            <SelectValue placeholder={t("selectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {(definition.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <SettingMultiSelect
          id={id}
          definition={definition}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "number-list":
      return (
        <ChipInput
          id={id}
          numeric
          values={asStringArray(value)}
          onChange={(v) => onChange(v.map(Number))}
          placeholder={t("listPlaceholder")}
          disabled={disabled}
          className="w-full"
        />
      );
    case "string-list":
      return (
        <ChipInput
          id={id}
          values={asStringArray(value)}
          onChange={onChange}
          placeholder={t("listPlaceholder")}
          disabled={disabled}
          className="w-full"
        />
      );
    case "textarea":
      return (
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full"
        />
      );
    case "json":
      return (
        <Textarea
          id={id}
          value={
            typeof value === "string"
              ? value
              : JSON.stringify(value ?? null, null, 2)
          }
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={6}
          className="w-full font-mono text-[0.8125rem]"
        />
      );
    case "time":
      return (
        <Input
          id={id}
          type="time"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full"
        />
      );
    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="color"
            value={typeof value === "string" ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-10 w-14 shrink-0 cursor-pointer p-1"
          />
          <span className="text-muted-foreground truncate font-mono text-[0.8125rem]">
            {String(value ?? "")}
          </span>
        </div>
      );
    case "secret":
      return (
        <SecretInput
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case "text":
    default:
      return (
        <Input
          id={id}
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full"
        />
      );
  }
}

export function SettingField({
  definition,
  value,
  onChange,
  onReset,
  disabled,
  isDirty,
}: SettingFieldProps) {
  const t = useTranslations("platform.settings");
  const id = `setting-${definition.key}`;
  const inline = definition.input === "boolean";
  return (
    <div
      className={cn(
        "group flex h-full min-w-0 flex-col gap-3 rounded-md border p-4 transition-colors",
        isDirty && "border-primary/60 bg-primary/[0.04]"
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Label
            htmlFor={id}
            title={definition.label}
            className="text-foreground block min-w-0 truncate text-[0.9375rem] font-medium"
          >
            {definition.label}
          </Label>
          {definition.description && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary shrink-0"
                    aria-label={t("help")}
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {definition.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <code
            title={definition.key}
            className="text-muted-foreground min-w-0 truncate text-xs"
          >
            {definition.key}
          </code>
          {definition.isOverridden ? (
            <Badge variant="primary" className="h-5 shrink-0 px-1.5 text-xs">
              {t("overridden")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-xs">
              {t("default")}
            </Badge>
          )}
          {definition.isOverridden && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={onReset}
              className="text-muted-foreground hover:text-primary ml-auto h-6 shrink-0 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <RotateCcw className="size-3.5" />
              {t("resetToDefault")}
            </Button>
          )}
        </div>
      </div>
      <div className={cn("mt-auto min-w-0", inline && "flex items-center")}>
        <FieldControl
          definition={definition}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
