// src/components/approvals/category-picker.tsx
"use client";

import { CategoryFormDialog } from "@/components/taxonomy/category-form-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import type { ApprovalCategoryOption } from "@/types/approval";
import type { CategoryNode, CategoryRow } from "@/types/taxonomy";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

interface Props {
  categories: ApprovalCategoryOption[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  error?: string;
  /** Override the `categories:manage` check for the "+ Create …" rows. */
  canCreate?: boolean;
}

interface CreateState {
  name: string;
  parent: ApprovalCategoryOption | null;
}

/** Minimal node for CategoryFormDialog, which only reads id and name. */
function asParentNode(option: ApprovalCategoryOption): CategoryNode {
  return {
    ...option,
    slug: "",
    isArchived: false,
    isDefault: false,
    sortOrder: 0,
    budgetMonthly: null,
    children: [],
  };
}

function toOption(row: CategoryRow): ApprovalCategoryOption {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    color: row.color,
    icon: row.icon,
  };
}

/** Two-level category picker: parent first, then optional child. */
export function CategoryPicker({
  categories: provided,
  value,
  onChange,
  error,
  canCreate,
}: Props) {
  const t = useTranslations("approvals.form");
  const ti = useTranslations("platform.masters.inline");
  const mayManage = usePermissionFlag("categories:manage");
  const allowCreate = canCreate ?? mayManage;
  const [created, setCreated] = useState<ApprovalCategoryOption[]>([]);
  const [creating, setCreating] = useState<CreateState | null>(null);
  const categories = useMemo(
    () => [
      ...provided,
      ...created.filter((c) => !provided.some((p) => p.id === c.id)),
    ],
    [provided, created]
  );
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
  const parentOption = parentId ? (byId.get(parentId) ?? null) : null;
  const createOption = (parent: ApprovalCategoryOption | null) =>
    allowCreate
      ? {
          label: (q: string) =>
            q ? ti("create", { name: q }) : ti("createEmpty"),
          onCreate: (q: string) => setCreating({ name: q, parent }),
        }
      : undefined;

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
          <SelectContent createOption={createOption(null)}>
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
          disabled={!parentOption || (children.length === 0 && !allowCreate)}
        >
          <SelectTrigger id="subcategory">
            <SelectValue placeholder={t("selectSubcategory")} />
          </SelectTrigger>
          <SelectContent createOption={createOption(parentOption)}>
            {children.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {creating && (
        <CategoryFormDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          parent={creating.parent ? asParentNode(creating.parent) : null}
          defaultName={creating.name}
          onSaved={(row) => {
            if (!row) return;
            setCreated((list) => [...list, toOption(row)]);
            onChange(row.id);
          }}
        />
      )}
    </div>
  );
}
