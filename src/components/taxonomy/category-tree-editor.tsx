// src/components/taxonomy/category-tree-editor.tsx
"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FolderPlus,
  Pencil,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  archiveCategory,
  reorderCategories,
  restoreCategory,
} from "@/actions/taxonomy/categories";
import {
  MasterListToolbar,
  useMasterList,
} from "@/components/platform/masters/master-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/types/taxonomy";

import {
  CategoryFormDialog,
  type CategoryFormDialogProps,
} from "./category-form-dialog";
import { CategoryListView, flattenCategories } from "./category-list-view";

export interface CategoryTreeEditorProps {
  tree: CategoryNode[];
  canManage: boolean;
}

type DialogState = Pick<CategoryFormDialogProps, "category" | "parent"> | null;
type CategoryView = "tree" | "list";

const VIEW_ITEM_CLASSES =
  "text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-primary h-8 shrink-0 rounded-sm px-3 text-sm whitespace-nowrap data-[state=on]:font-medium data-[state=on]:shadow-xs";

function moveId(ids: string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface RowProps {
  node: CategoryNode;
  siblings: CategoryNode[];
  canManage: boolean;
  isChild?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onEdit: () => void;
  onAddChild?: () => void;
  onChanged: () => void;
}

function CategoryRow({
  node,
  siblings,
  canManage,
  isChild,
  expanded,
  onToggle,
  onEdit,
  onAddChild,
  onChanged,
}: RowProps) {
  const t = useTranslations("taxonomy.categories");
  const tc = useTranslations("taxonomy.common");
  const [busy, setBusy] = useState(false);
  const ids = siblings.map((s) => s.id);
  const index = ids.indexOf(node.id);

  const run = async (
    fn: () => Promise<{ success: boolean; error?: string; message?: string }>
  ) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.success) return toast.error(result.error ?? tc("errorGeneric"));
    if (result.message) toast.success(result.message);
    onChanged();
  };
  const move = (direction: -1 | 1) => {
    const next = moveId(ids, node.id, direction);
    if (next)
      void run(() =>
        reorderCategories({ parentId: node.parentId, orderedIds: next })
      );
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors",
        isChild ? "hover:bg-muted/50 ml-7 border-l pl-4" : "hover:bg-muted/60",
        node.isArchived && "opacity-60"
      )}
    >
      {!isChild ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? t("collapse") : t("expand")}
          aria-expanded={expanded}
          className="text-muted-foreground hover:text-foreground -ml-1 rounded p-0.5"
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-90"
            )}
          />
        </button>
      ) : null}
      <span
        aria-hidden
        className={cn("shrink-0 rounded-full", isChild ? "size-2" : "size-3")}
        style={{ backgroundColor: node.color ?? "var(--muted-foreground)" }}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={cn("truncate", isChild ? "text-sm" : "font-medium")}>
          {node.name}
        </span>
        {node.isDefault && (
          <Badge
            variant="outline"
            className="text-muted-foreground h-5 font-normal"
          >
            {tc("default")}
          </Badge>
        )}
        {node.isArchived && (
          <Badge variant="secondary" className="h-5 font-normal">
            {tc("archived")}
          </Badge>
        )}
        {node.budgetMonthly !== null && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("budgetShort", { amount: node.budgetMonthly.toLocaleString() })}
          </span>
        )}
      </div>
      <span className="text-muted-foreground w-28 shrink-0 text-right text-xs tabular-nums">
        {tc("usage", { count: node.usageCount ?? 0 })}
      </span>
      {canManage && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tc("moveUp")}
            disabled={busy || index <= 0}
            onClick={() => move(-1)}
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tc("moveDown")}
            disabled={busy || index >= ids.length - 1}
            onClick={() => move(1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
          {onAddChild && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("addSub")}
              disabled={busy || node.isArchived}
              onClick={onAddChild}
            >
              <FolderPlus className="size-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tc("edit")}
            disabled={busy}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
          {node.isArchived ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tc("restore")}
              disabled={busy}
              onClick={() => run(() => restoreCategory(node.id))}
            >
              <ArchiveRestore className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={tc("archive")}
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `${t("archiveConfirmTitle", { name: node.name })}\n${t("archiveConfirmBody")}`
                  )
                ) {
                  void run(() => archiveCategory(node.id));
                }
              }}
            >
              <Archive className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Two-level tree editor with inline reorder, archive and edit dialogs. */
export function CategoryTreeEditor({
  tree,
  canManage,
}: CategoryTreeEditorProps) {
  const t = useTranslations("taxonomy.categories");
  const tc = useTranslations("taxonomy.common");
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<DialogState>(null);

  const visible = useMemo(() => {
    const keep = (n: CategoryNode) => showArchived || !n.isArchived;
    return tree
      .filter(keep)
      .map((p) => ({ ...p, children: p.children.filter(keep) }));
  }, [tree, showArchived]);
  const refresh = () => router.refresh();
  const [view, setView] = useState<CategoryView>("tree");
  const flat = useMemo(() => flattenCategories(visible), [visible]);
  const list = useMasterList(flat, {
    searchText: (row) => [row.node.name, row.parent?.name],
  });
  const isSearching = list.query.trim() !== "";
  // Tree shown while searching: a parent stays when it or a child matches.
  // Reordering still uses the full `visible` siblings, never the filtered ones.
  const treeShown = useMemo(() => {
    if (!isSearching) return visible;
    const hit = new Set(list.visible.map((row) => row.node.id));
    return visible
      .filter((p) => hit.has(p.id) || p.children.some((c) => hit.has(c.id)))
      .map((p) =>
        hit.has(p.id)
          ? p
          : { ...p, children: p.children.filter((c) => hit.has(c.id)) }
      );
  }, [visible, list.visible, isSearching]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as CategoryView)}
            aria-label={t("viewLabel")}
            className="bg-muted shrink-0 gap-0 rounded-md p-[3px]"
          >
            <ToggleGroupItem value="tree" className={VIEW_ITEM_CLASSES}>
              {t("viewTree")}
            </ToggleGroupItem>
            <ToggleGroupItem value="list" className={VIEW_ITEM_CLASSES}>
              {t("viewList")}
            </ToggleGroupItem>
          </ToggleGroup>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Switch
              checked={showArchived}
              onCheckedChange={setShowArchived}
              aria-label={tc("showArchived")}
            />
            {tc("showArchived")}
          </label>
          {canManage && (
            <Button type="button" size="sm" onClick={() => setDialog({})}>
              <Plus className="size-4" />
              {t("addTopLevel")}
            </Button>
          )}
        </div>
      </div>

      {visible.length > 0 && (
        <MasterListToolbar list={list} searchPlaceholder={t("search")} />
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {t("empty")}
        </p>
      ) : view === "list" ? (
        <CategoryListView
          rows={list.visible}
          canManage={canManage}
          onEdit={(node) => setDialog({ category: node })}
          onChanged={refresh}
        />
      ) : treeShown.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-8 text-center text-sm">
          {tc("noResults")}
        </p>
      ) : (
        <div className="divide-y rounded-md border">
          {treeShown.map((parent) => {
            const expanded = !collapsed[parent.id];
            return (
              <div key={parent.id} className="py-1">
                <CategoryRow
                  node={parent}
                  siblings={visible}
                  canManage={canManage}
                  expanded={expanded}
                  onToggle={() =>
                    setCollapsed((c) => ({ ...c, [parent.id]: expanded }))
                  }
                  onEdit={() => setDialog({ category: parent })}
                  onAddChild={() => setDialog({ parent })}
                  onChanged={refresh}
                />
                {expanded && (
                  <div className="space-y-0.5 pb-1">
                    {parent.children.length === 0 ? (
                      <p className="text-muted-foreground ml-11 py-1 text-xs italic">
                        {t("noSubcategories")}
                      </p>
                    ) : (
                      parent.children.map((child) => (
                        <CategoryRow
                          key={child.id}
                          node={child}
                          siblings={
                            visible.find((p) => p.id === parent.id)?.children ??
                            parent.children
                          }
                          canManage={canManage}
                          isChild
                          onEdit={() => setDialog({ category: child })}
                          onChanged={refresh}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dialog && (
        <CategoryFormDialog
          key={dialog.category?.id ?? dialog.parent?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          category={dialog.category}
          parent={dialog.parent}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
