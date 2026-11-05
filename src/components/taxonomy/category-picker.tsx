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
import { findCategoryNode } from "@/lib/services/taxonomy/category-tree";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/types/taxonomy";

const PARENT_ONLY = "__parent__";
const CLEAR = "__clear__";

export interface CategoryPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Pre-loaded tree; when omitted the picker fetches it. */
  tree?: CategoryNode[];
  className?: string;
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
}: CategoryPickerProps) {
  const t = useTranslations("taxonomy.picker");
  const [loaded, setLoaded] = useState<CategoryNode[] | null>(tree ?? null);
  const [isLoading, setIsLoading] = useState(!tree);

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
    if (next === CLEAR) return onChange(null);
    onChange(next);
  };
  const handleChild = (next: string) => {
    if (!parent) return;
    onChange(next === PARENT_ONLY ? parent.id : next);
  };

  return (
    <div className={cn("grid min-w-0 gap-2 sm:grid-cols-2", className)}>
      <Select
        value={parentId ?? ""}
        onValueChange={handleParent}
        disabled={disabled || isLoading}
      >
        <SelectTrigger aria-label={t("parentPlaceholder")} className="w-full">
          <SelectValue placeholder={placeholder ?? t("parentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
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
        disabled={disabled || isLoading || !parent || children.length === 0}
      >
        <SelectTrigger aria-label={t("childPlaceholder")} className="w-full">
          <SelectValue placeholder={t("childPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
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
    </div>
  );
}
