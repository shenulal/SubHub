// src/components/taxonomy/tag-manager.tsx
"use client";

import { Check, GitMerge, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteTag,
  ensureTags,
  renameTag,
  setTagColor,
} from "@/actions/taxonomy/tags";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TagDto } from "@/types/taxonomy";

import { TagMergeDialog } from "./tag-merge-dialog";

export interface TagManagerProps {
  tags: TagDto[];
  canManage: boolean;
  canCreate: boolean;
}

type Result = { success: boolean; error?: string; message?: string };

function TagRow({
  tag,
  canManage,
  selected,
  onSelect,
  onChanged,
}: {
  tag: TagDto;
  canManage: boolean;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onChanged: () => void;
}) {
  const t = useTranslations("taxonomy.tags");
  const tc = useTranslations("taxonomy.common");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.success) return toast.error(result.error ?? tc("errorGeneric"));
    if (result.message) toast.success(result.message);
    onChanged();
  };
  const commitRename = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== tag.name)
      void run(() => renameTag(tag.id, name));
    else setName(tag.name);
  };

  return (
    <tr
      className={cn("group border-b last:border-0", selected && "bg-muted/40")}
    >
      <td className="w-8 px-2 py-2">
        {canManage && (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelect(Boolean(v))}
            aria-label={tag.name}
          />
        )}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={t("columns.color")}
            value={tag.color ?? "#94a3b8"}
            disabled={!canManage || busy}
            onChange={(e) =>
              void run(() => setTagColor(tag.id, e.target.value))
            }
            className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0 disabled:cursor-default [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
          />
          {editing ? (
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                commitRename();
              }}
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="h-7 w-48"
                maxLength={40}
                onKeyDown={(e) =>
                  e.key === "Escape" && (setEditing(false), setName(tag.name))
                }
              />
              <Button
                type="submit"
                size="icon-sm"
                variant="ghost"
                aria-label={tc("save")}
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={tc("cancel")}
                onClick={() => {
                  setEditing(false);
                  setName(tag.name);
                }}
              >
                <X className="size-3.5" />
              </Button>
            </form>
          ) : (
            <span className="text-sm font-medium">{tag.name}</span>
          )}
        </div>
      </td>
      <td className="text-muted-foreground px-2 py-2 text-right text-xs tabular-nums">
        {tc("usage", { count: tag.usageCount ?? 0 })}
      </td>
      <td className="w-24 px-2 py-2 text-right">
        {canManage && !editing && (
          <div className="flex justify-end gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={tc("rename")}
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={tc("delete")}
              disabled={busy}
              className="hover:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    `${t("deleteConfirmTitle", { name: tag.name })}\n${t("deleteConfirmBody", { count: tag.usageCount ?? 0 })}`
                  )
                )
                  void run(() => deleteTag(tag.id));
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function TagManager({ tags, canManage, canCreate }: TagManagerProps) {
  const t = useTranslations("taxonomy.tags");
  const tc = useTranslations("taxonomy.common");
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const refresh = () => {
    setSelected(new Set());
    router.refresh();
  };

  const create = async () => {
    if (!newName.trim()) return;
    try {
      await ensureTags([newName]);
      setNewName("");
      toast.success(t("newTag"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tc("errorGeneric"));
    }
  };
  const selectedTags = tags.filter((tag) => selected.has(tag.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-sm">
          {t("description")}
        </p>
        {canCreate && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("placeholder")}
              className="h-9 w-48"
              maxLength={40}
              aria-label={t("nameLabel")}
            />
            <Button type="submit" size="sm" disabled={!newName.trim()}>
              <Plus className="size-4" />
              {tc("add")}
            </Button>
          </form>
        )}
      </div>

      {canManage && selected.size > 0 && (
        <div className="bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
          <span>{t("selected", { count: selected.size })}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
            >
              {t("clearSelection")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsMergeOpen(true)}
            >
              <GitMerge className="size-4" />
              {t("merge")}
            </Button>
          </div>
        </div>
      )}

      {tags.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {t("noTags")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 text-left font-medium">
                  {t("columns.name")}
                </th>
                <th className="px-2 py-2 text-right font-medium">
                  {t("columns.usage")}
                </th>
                <th className="w-24 px-2 py-2 text-right font-medium">
                  {tc("actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  canManage={canManage}
                  selected={selected.has(tag.id)}
                  onSelect={(v) =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (v) next.add(tag.id);
                      else next.delete(tag.id);
                      return next;
                    })
                  }
                  onChanged={refresh}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isMergeOpen && (
        <TagMergeDialog
          open
          onOpenChange={(o) => !o && setIsMergeOpen(false)}
          selected={selectedTags}
          allTags={tags}
          onMerged={refresh}
        />
      )}
    </div>
  );
}
