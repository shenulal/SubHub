// src/components/common/quick-create/create-tag-dialog.tsx
"use client";

/** Minimal tag creation (find-or-create via `ensureTags`, which needs `tags:create`). */
import { ensureTags } from "@/actions/taxonomy/tags";
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
import type { TagDto } from "@/types/taxonomy";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FieldError, RequiredMark } from "./form-bits";

interface CreateTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onCreated?: (tag: TagDto) => void;
}

export function CreateTagDialog({
  open,
  onOpenChange,
  defaultName = "",
  onCreated,
}: CreateTagDialogProps) {
  const t = useTranslations("shell.createTag");
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setError(undefined);
    }
  }, [open, defaultName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Dialogs are often rendered inside another form; keep its submit untouched.
    event.stopPropagation();
    if (savingRef.current || !name.trim()) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const [tag] = await ensureTags([name.trim()]);
      if (!tag) throw new Error(t("error"));
      toast.success(t("success", { name: tag.name }));
      onCreated?.(tag);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : t("error");
      setError(message);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="create-tag-name">
              {t("name")}
              <RequiredMark />
            </Label>
            <Input
              id="create-tag-name"
              autoFocus
              value={name}
              placeholder={t("namePlaceholder")}
              aria-invalid={Boolean(error)}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
            />
            <FieldError message={error} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSaving ? t("creating") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
