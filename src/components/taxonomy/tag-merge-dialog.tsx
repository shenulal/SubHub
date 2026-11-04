// src/components/taxonomy/tag-merge-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { mergeTags } from "@/actions/taxonomy/tags";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagDto } from "@/types/taxonomy";

export interface TagMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tags selected for merging (sources + optionally the target). */
  selected: TagDto[];
  allTags: TagDto[];
  onMerged?: () => void;
}

export function TagMergeDialog({
  open,
  onOpenChange,
  selected,
  allTags,
  onMerged,
}: TagMergeDialogProps) {
  const t = useTranslations("taxonomy.tags");
  const tc = useTranslations("taxonomy.common");
  const [targetId, setTargetId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!targetId) return;
    setIsSaving(true);
    const result = await mergeTags(
      selected.map((s) => s.id).filter((id) => id !== targetId),
      targetId
    );
    setIsSaving(false);
    if (!result.success) return toast.error(result.error ?? tc("errorGeneric"));
    toast.success(result.message ?? t("merge"));
    onOpenChange(false);
    onMerged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("mergeTitle", { count: selected.length })}
          </DialogTitle>
          <DialogDescription>{t("mergeDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {selected.map((s) => (
              <span
                key={s.id}
                className="bg-secondary text-secondary-foreground rounded-md border px-2 py-0.5 text-xs font-medium"
              >
                {s.name}
              </span>
            ))}
          </div>
          <label className="grid gap-1.5 text-sm">
            {t("mergeTarget")}
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("mergeTargetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {allTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                    {typeof tag.usageCount === "number" && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {tag.usageCount}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
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
          <Button
            type="button"
            onClick={submit}
            disabled={isSaving || !targetId}
          >
            {isSaving ? tc("saving") : t("merge")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
