// src/components/taxonomy/category-form-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { createCategory, updateCategory } from "@/actions/taxonomy/categories";
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
import type { CategoryNode, CategoryRow } from "@/types/taxonomy";

export interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing node; omit to create. */
  category?: CategoryNode | null;
  /** Parent for a new subcategory. */
  parent?: CategoryNode | null;
  /** Prefilled name for a new category (inline creation from a picker). */
  defaultName?: string;
  /** Receives the saved row (create and edit). */
  onSaved?: (category?: CategoryRow) => void;
}

const DEFAULT_COLOR = "#6366f1";

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parent,
  defaultName,
  onSaved,
}: CategoryFormDialogProps) {
  const t = useTranslations("taxonomy.categories");
  const tc = useTranslations("taxonomy.common");
  const isEdit = Boolean(category);
  const isTopLevel = isEdit ? !category?.parentId : !parent;
  const [name, setName] = useState(category?.name ?? defaultName ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState(
    category?.color ?? (isTopLevel ? DEFAULT_COLOR : "")
  );
  const [useColor, setUseColor] = useState(
    Boolean(category?.color) || isTopLevel
  );
  const [budget, setBudget] = useState(
    category?.budgetMonthly !== null && category?.budgetMonthly !== undefined
      ? String(category.budgetMonthly)
      : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const title = isEdit
    ? t("editTitle")
    : parent
      ? t("createSubTitle", { parent: parent.name })
      : t("createTitle");

  const submit = async () => {
    setIsSaving(true);
    setFieldErrors({});
    const payload = {
      name,
      icon: icon.trim() || null,
      color: useColor && color ? color : null,
      budgetMonthly: budget.trim() ? Number(budget) : null,
    };
    const result =
      isEdit && category
        ? await updateCategory(category.id, payload)
        : await createCategory({ ...payload, parentId: parent?.id ?? null });
    setIsSaving(false);
    if (!result.success) {
      setFieldErrors(result.errors ?? {});
      toast.error(result.error ?? tc("errorGeneric"));
      return;
    }
    toast.success(result.message ?? tc("save"));
    onOpenChange(false);
    onSaved?.(result.data ?? undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            // Rendered inside other forms (subscription, app); don't submit them too.
            e.stopPropagation();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">{t("nameLabel")}</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="text-destructive text-xs">{fieldErrors.name[0]}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-icon">{t("iconLabel")}</Label>
              <Input
                id="cat-icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder={t("iconHint")}
                maxLength={40}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-color">{t("colorLabel")}</Label>
              <div className="flex items-center gap-2">
                <input
                  id="cat-color"
                  type="color"
                  value={color || DEFAULT_COLOR}
                  disabled={!useColor}
                  onChange={(e) => setColor(e.target.value)}
                  className="border-input size-9 cursor-pointer rounded-md border bg-transparent p-1 disabled:opacity-40"
                />
                <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={useColor}
                    onChange={(e) => setUseColor(e.target.checked)}
                    className="accent-primary"
                  />
                  {useColor ? color || DEFAULT_COLOR : tc("none")}
                </label>
              </div>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cat-budget">{t("budgetLabel")}</Label>
            <Input
              id="cat-budget"
              type="number"
              min={0}
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
              className="w-48"
              aria-invalid={Boolean(fieldErrors.budgetMonthly)}
            />
            <p className="text-muted-foreground text-xs">{t("budgetHint")}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
