"use client";

import { createRole, updateRole } from "@/actions/platform/roles";
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
import { Textarea } from "@/components/ui/textarea";
import type { PermissionGroupRow, RoleRow } from "@/types/platform";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PermissionMatrix } from "./permission-matrix";

interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleRow | null;
  groups: PermissionGroupRow[];
}

export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  groups,
}: RoleEditorDialogProps) {
  const t = useTranslations("platform.roles");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const readOnly = Boolean(role?.isSystem);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissionKeys ?? []));
  }, [open, role]);

  const save = () => {
    const payload = {
      name,
      description: description || null,
      permissionKeys: Array.from(selected),
    };
    startTransition(async () => {
      const result = role
        ? await updateRole(role.id, payload)
        : await createRole(payload);
      if (result.success) {
        toast.success(t("saved"));
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error ?? t("saveFailed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-5 overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {role
              ? readOnly
                ? t("viewTitle", { name: role.name })
                : t("editTitle")
              : t("createTitle")}
          </DialogTitle>
          <DialogDescription>
            {readOnly ? t("systemReadOnly") : t("editorDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid shrink-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="role-name">{t("name")}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="role-description">{t("description")}</Label>
            <Textarea
              id="role-description"
              rows={1}
              className="min-h-10"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <Label>{t("permissions")}</Label>
            <span className="text-muted-foreground text-[0.8125rem] tabular-nums">
              {t("selectedCount", { count: selected.size })}
            </span>
          </div>
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            <PermissionMatrix
              groups={groups}
              selected={selected}
              onChange={setSelected}
              readOnly={readOnly}
            />
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-3 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
