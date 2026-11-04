// src/components/taxonomy/custom-field-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  createCustomField,
  updateCustomField,
} from "@/actions/taxonomy/custom-fields";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type {
  CustomFieldDefinitionDto,
  CustomFieldTypeValue,
} from "@/types/taxonomy";

const FIELD_TYPES: CustomFieldTypeValue[] = [
  "TEXT",
  "NUMBER",
  "DATE",
  "SELECT",
];

export interface CustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field?: CustomFieldDefinitionDto | null;
  onSaved?: () => void;
}

export function CustomFieldDialog({
  open,
  onOpenChange,
  field,
  onSaved,
}: CustomFieldDialogProps) {
  const t = useTranslations("taxonomy.customFields");
  const tc = useTranslations("taxonomy.common");
  const isEdit = Boolean(field);
  const [label, setLabel] = useState(field?.label ?? "");
  const [key, setKey] = useState(field?.key ?? "");
  const [fieldType, setFieldType] = useState<CustomFieldTypeValue>(
    field?.fieldType ?? "TEXT"
  );
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = async () => {
    setIsSaving(true);
    setErrors({});
    const optionList = options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    const result =
      isEdit && field
        ? await updateCustomField(field.id, {
            label,
            isRequired,
            ...(field.fieldType === "SELECT" && { options: optionList }),
          })
        : await createCustomField({
            label,
            key: key.trim() || undefined,
            fieldType,
            isRequired,
            options: fieldType === "SELECT" ? optionList : null,
          });
    setIsSaving(false);
    if (!result.success) {
      setErrors(result.errors ?? {});
      toast.error(result.error ?? tc("errorGeneric"));
      return;
    }
    toast.success(result.message ?? tc("save"));
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cf-label">{t("labelLabel")}</Label>
            <Input
              id="cf-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              maxLength={80}
              aria-invalid={Boolean(errors.label)}
            />
            {errors.label && (
              <p className="text-destructive text-xs">{errors.label[0]}</p>
            )}
          </div>
          {!isEdit && (
            <div className="grid gap-1.5">
              <Label htmlFor="cf-key">{t("keyLabel")}</Label>
              <Input
                id="cf-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="contract_owner"
                maxLength={40}
                className="font-mono text-sm"
                aria-invalid={Boolean(errors.key)}
              />
              <p className="text-muted-foreground text-xs">{t("keyHint")}</p>
              {errors.key && (
                <p className="text-destructive text-xs">{errors.key[0]}</p>
              )}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="cf-type">{t("typeLabel")}</Label>
            <Select
              value={fieldType}
              onValueChange={(v) => setFieldType(v as CustomFieldTypeValue)}
              disabled={isEdit}
            >
              <SelectTrigger id="cf-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {fieldType === "SELECT" && (
            <div className="grid gap-1.5">
              <Label htmlFor="cf-options">{t("optionsLabel")}</Label>
              <Textarea
                id="cf-options"
                rows={4}
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                aria-invalid={Boolean(errors.options)}
              />
              <p className="text-muted-foreground text-xs">
                {t("optionsHint")}
              </p>
              {errors.options && (
                <p className="text-destructive text-xs">{errors.options[0]}</p>
              )}
            </div>
          )}
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("requiredLabel")}
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !label.trim()}>
              {isSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
