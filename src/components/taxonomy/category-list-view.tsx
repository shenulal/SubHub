// src/components/taxonomy/category-list-view.tsx
"use client";

/**
 * Flat "List" view of the category master: one row per category or
 * subcategory with its parent, usage and status. Edit and archive/restore act
 * the same as in the tree; reordering stays in the tree view.
 */

import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  archiveCategory,
  restoreCategory,
} from "@/actions/taxonomy/categories";
import { MasterListNoMatches } from "@/components/platform/masters/master-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/types/taxonomy";

export interface FlatCategory {
  node: CategoryNode;
  parent: CategoryNode | null;
}

/** Parents followed by their children, in tree order. */
export function flattenCategories(tree: CategoryNode[]): FlatCategory[] {
  return tree.flatMap((parent) => [
    { node: parent, parent: null },
    ...parent.children.map((child) => ({ node: child, parent })),
  ]);
}

type ActionResult = { success: boolean; error?: string; message?: string };

interface CategoryListViewProps {
  rows: FlatCategory[];
  canManage: boolean;
  onEdit: (node: CategoryNode) => void;
  onChanged: () => void;
}

export function CategoryListView({
  rows,
  canManage,
  onEdit,
  onChanged,
}: CategoryListViewProps) {
  const t = useTranslations("taxonomy.categories");
  const tc = useTranslations("taxonomy.common");
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<ActionResult>) => {
    setBusyId(id);
    const result = await fn();
    setBusyId(null);
    if (!result.success) return toast.error(result.error ?? tc("errorGeneric"));
    if (result.message) toast.success(result.message);
    onChanged();
  };

  const archive = (node: CategoryNode) => {
    const ok = window.confirm(
      `${t("archiveConfirmTitle", { name: node.name })}\n${t("archiveConfirmBody")}`
    );
    if (ok) void run(node.id, () => archiveCategory(node.id));
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.parent")}</TableHead>
            <TableHead className="w-32 text-right">
              {t("columns.subscriptions")}
            </TableHead>
            <TableHead className="w-28">{t("columns.status")}</TableHead>
            {canManage && (
              <TableHead className="w-24 text-right">{tc("actions")}</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <MasterListNoMatches colSpan={canManage ? 5 : 4} />
          )}
          {rows.map(({ node, parent }) => {
            const busy = busyId === node.id;
            return (
              <TableRow
                key={node.id}
                className={cn(node.isArchived && "opacity-60")}
              >
                <TableCell>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0 rounded-full",
                        parent ? "size-2" : "size-3"
                      )}
                      style={{
                        backgroundColor:
                          node.color ?? "var(--muted-foreground)",
                      }}
                    />
                    <span className={cn(!parent && "font-medium")}>
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
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {parent ? parent.name : t("topLevel")}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                  {tc("usage", { count: node.usageCount ?? 0 })}
                </TableCell>
                <TableCell>
                  {node.isArchived ? (
                    <Badge variant="secondary" className="h-5 font-normal">
                      {tc("archived")}
                    </Badge>
                  ) : (
                    <span className="tonal-success rounded-full px-2 py-0.5 text-xs font-medium">
                      {t("statusActive")}
                    </span>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${tc("edit")} ${node.name}`}
                        disabled={busy}
                        onClick={() => onEdit(node)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {node.isArchived ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${tc("restore")} ${node.name}`}
                          disabled={busy}
                          onClick={() =>
                            void run(node.id, () => restoreCategory(node.id))
                          }
                        >
                          <ArchiveRestore className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${tc("archive")} ${node.name}`}
                          disabled={busy}
                          onClick={() => archive(node)}
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
