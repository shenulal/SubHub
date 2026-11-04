// src/components/approvals/category-picker.tsx
"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApprovalCategoryOption } from "@/types/approval";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface Props {
  categories: ApprovalCategoryOption[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  error?: string;
}

/** Two-level category picker: parent first, then optional child. */
export function CategoryPicker({ categories, value, onChange, error }: Props) {
  const t = useTranslations("approvals.form");
  const parents = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories]
  );
  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const selected = value ? byId.get(value) : undefined;
  const parentId = selected?.parentId ?? selected?.id ?? null;
  const children = useMemo(
    () => (parentId ? categories.filter((c) => c.parentId === parentId) : []),
    [categories, parentId]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="category">{t("category")}</Label>
        <Select
          value={parentId ?? ""}
          onValueChange={(id) => onChange(id || null)}
        >
          <SelectTrigger id="category" aria-invalid={Boolean(error)}>
            <SelectValue placeholder={t("selectCategory")} />
          </SelectTrigger>
          <SelectContent>
            {parents.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  {c.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                  )}
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="subcategory">{t("subcategory")}</Label>
        <Select
          value={selected?.parentId ? selected.id : ""}
          onValueChange={(id) => onChange(id || parentId)}
          disabled={children.length === 0}
        >
          <SelectTrigger id="subcategory">
            <SelectValue placeholder={t("selectSubcategory")} />
          </SelectTrigger>
          <SelectContent>
            {children.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
