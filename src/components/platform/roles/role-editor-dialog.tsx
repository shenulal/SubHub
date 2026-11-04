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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">{t("name")}</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">{t("description")}</Label>
            <Textarea
              id="role-description"
              rows={1}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
        <div className="mt-2">
          <div className="mb-2 flex items-center justify-between">
            <Label>{t("permissions")}</Label>
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("selectedCount", { count: selected.size })}
            </span>
          </div>
          <PermissionMatrix
            groups={groups}
            selected={selected}
            onChange={setSelected}
            readOnly={readOnly}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          {!readOnly && (
            <Button onClick={save} disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
