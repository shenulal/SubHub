// src/components/taxonomy/category-picker.tsx
"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { getCategoryTree } from "@/actions/taxonomy/categories";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissionFlag } from "@/hooks/use-permission-flag";
import { findCategoryNode } from "@/lib/services/taxonomy/category-tree";
import { cn } from "@/lib/utils";
import type { CategoryNode, CategoryRow } from "@/types/taxonomy";

import { CategoryFormDialog } from "./category-form-dialog";

const PARENT_ONLY = "__parent__";
const CLEAR = "__clear__";

export interface CategoryPickerProps {
  value: string | null;
  /** Receives the selected id and, when known, its node (name/slug). */
  onChange: (id: string | null, node?: CategoryNode | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Pre-loaded tree; when omitted the picker fetches it. */
  tree?: CategoryNode[];
  className?: string;
  /** id for the category trigger (pairs with an external <Label htmlFor>). */
  id?: string;
  /**
   * Show "+ Create …" rows. Defaults to the viewer's `categories:manage`
   * permission (the server action re-checks it).
   */
  canCreate?: boolean;
}

interface CreateState {
  name: string;
  parent: CategoryNode | null;
}

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="bg-muted-foreground/40 inline-block size-2 shrink-0 rounded-full"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** Two-level cascading select: category → optional subcategory. */
export function CategoryPicker({
  value,
  onChange,
  disabled,
  placeholder,
  tree,
  className,
  id,
  canCreate,
}: CategoryPickerProps) {
  const t = useTranslations("taxonomy.picker");
  const ti = useTranslations("platform.masters.inline");
  const mayManage = usePermissionFlag("categories:manage");
  const allowCreate = canCreate ?? mayManage;
  const [loaded, setLoaded] = useState<CategoryNode[] | null>(tree ?? null);
  const [isLoading, setIsLoading] = useState(!tree);
  const [creating, setCreating] = useState<CreateState | null>(null);

  useEffect(() => {
    if (tree) {
      setLoaded(tree);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    getCategoryTree()
      .then((data) => {
        if (!cancelled) setLoaded(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tree]);

  const nodes = useMemo(() => loaded ?? [], [loaded]);
  const selected = useMemo(
    () => findCategoryNode(nodes, value),
    [nodes, value]
  );
  const parentId = selected ? (selected.parentId ?? selected.id) : null;
  const parent = nodes.find((n) => n.id === parentId) ?? null;
  const children = parent?.children ?? [];
  const childValue = selected && selected.parentId ? selected.id : PARENT_ONLY;

  const handleParent = (next: string) => {
    if (next === CLEAR) return onChange(null, null);
    onChange(next, findCategoryNode(nodes, next));
  };
  const handleChild = (next: string) => {
    if (!parent) return;
    const id = next === PARENT_ONLY ? parent.id : next;
    onChange(id, findCategoryNode(nodes, id));
  };

  const createOption = (forParent: CategoryNode | null) =>
    allowCreate
      ? {
          label: (q: string) =>
            q ? ti("create", { name: q }) : ti("createEmpty"),
          onCreate: (q: string) => setCreating({ name: q, parent: forParent }),
        }
      : undefined;

  const handleCreated = async (row?: CategoryRow) => {
    if (!row) return;
    const fresh = await getCategoryTree();
    setLoaded(fresh);
    onChange(row.id, findCategoryNode(fresh, row.id));
  };

  return (
    <div className={cn("grid min-w-0 gap-2 sm:grid-cols-2", className)}>
      <Select
        value={parentId ?? ""}
        onValueChange={handleParent}
        disabled={disabled || isLoading}
      >
        <SelectTrigger
          id={id}
          aria-label={id ? undefined : t("parentPlaceholder")}
          className="w-full"
        >
          <SelectValue placeholder={placeholder ?? t("parentPlaceholder")} />
        </SelectTrigger>
        <SelectContent createOption={createOption(null)}>
          {nodes.length === 0 && (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              {t("noCategories")}
            </div>
          )}
          {nodes.map((n) => (
            <SelectItem key={n.id} value={n.id}>
              <span className="flex items-center gap-2">
                <ColorDot color={n.color} />
                {n.name}
              </span>
            </SelectItem>
          ))}
          {parentId && (
            <SelectItem value={CLEAR} className="text-muted-foreground">
              {t("clear")}
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <Select
        value={parent ? childValue : ""}
        onValueChange={handleChild}
        disabled={
          disabled ||
          isLoading ||
          !parent ||
          (children.length === 0 && !allowCreate)
        }
      >
        <SelectTrigger aria-label={t("childPlaceholder")} className="w-full">
          <SelectValue placeholder={t("childPlaceholder")} />
        </SelectTrigger>
        <SelectContent createOption={createOption(parent)}>
          <SelectItem value={PARENT_ONLY} className="text-muted-foreground">
            {t("parentOnly")}
          </SelectItem>
          {children.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {creating && (
        <CategoryFormDialog
          open
          onOpenChange={(o) => !o && setCreating(null)}
          parent={creating.parent}
          defaultName={creating.name}
          onSaved={(row) => void handleCreated(row)}
        />
      )}
    </div>
  );
}
