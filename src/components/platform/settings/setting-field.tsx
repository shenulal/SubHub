"use client";

import { Badge } from "@/components/ui/badge";
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
          className="max-w-xs font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
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
        className="max-w-xs font-mono"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
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

function MultiSelect({
  definition,
  value,
  onChange,
  disabled,
}: {
  definition: SerializedSettingDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const selected = new Set(asStringArray(value));
  const toggle = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange(Array.from(next));
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {(definition.options ?? []).map((opt) => {
        const active = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
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
            className="max-w-[12rem] font-mono"
          />
          {definition.unit && (
            <span className="text-muted-foreground text-sm">
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
          <SelectTrigger id={id} className="max-w-sm">
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
        <MultiSelect
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
          className="max-w-lg"
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
          className="max-w-lg"
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
          className="max-w-lg"
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
          className="max-w-lg font-mono text-xs"
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
          className="max-w-[10rem]"
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
            className="h-10 w-14 cursor-pointer p-1"
          />
          <span className="text-muted-foreground font-mono text-sm">
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
          className="max-w-sm"
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
        "group border-border/60 grid gap-3 border-b py-5 last:border-b-0 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-8",
        isDirty && "bg-primary/[0.03] -mx-3 rounded-md px-3"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-sm font-semibold">
            {definition.label}
          </Label>
          {definition.description && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={t("help")}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-xs">
                  {definition.description}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <code className="text-muted-foreground text-[11px]">
            {definition.key}
          </code>
          {definition.isOverridden ? (
            <Badge
              variant="outline"
              className="border-primary/40 text-primary h-5 px-1.5 text-[10px]"
            >
              {t("overridden")}
            </Badge>
          ) : (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {t("default")}
            </Badge>
          )}
        </div>
      </div>
      <div className={cn("flex items-start gap-3", inline && "items-center")}>
        <div className="flex-1">
          <FieldControl
            definition={definition}
            value={value}
            onChange={onChange}
            disabled={disabled}
          />
        </div>
        {definition.isOverridden && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onReset}
            className="text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("resetToDefault")}
          </Button>
        )}
      </div>
    </div>
  );
}
