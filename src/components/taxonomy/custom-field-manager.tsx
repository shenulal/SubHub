// src/components/taxonomy/custom-field-manager.tsx
"use client";

import { isOptionFieldType } from "@/lib/services/taxonomy/custom-field-options";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  archiveCustomField,
  reorderCustomFields,
  restoreCustomField,
} from "@/actions/taxonomy/custom-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CustomFieldDefinitionDto } from "@/types/taxonomy";

import { CustomFieldDialog } from "./custom-field-dialog";

export interface CustomFieldManagerProps {
  fields: CustomFieldDefinitionDto[];
  maxFields: number;
  canManage: boolean;
}

type Result = { success: boolean; error?: string; message?: string };

export function CustomFieldManager({
  fields,
  maxFields,
  canManage,
}: CustomFieldManagerProps) {
  const t = useTranslations("taxonomy.customFields");
  const tc = useTranslations("taxonomy.common");
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<{
    field?: CustomFieldDefinitionDto;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = fields.filter((f) => !f.isArchived);
  const visible = showArchived ? fields : active;
  const limitReached = active.length >= maxFields;

  const run = async (fn: () => Promise<Result>) => {
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.success) return toast.error(result.error ?? tc("errorGeneric"));
    if (result.message) toast.success(result.message);
    router.refresh();
  };
  const move = (id: string, direction: -1 | 1) => {
    const ids = active.map((f) => f.id);
    const i = ids.indexOf(id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    void run(() => reorderCustomFields(next));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground max-w-prose text-sm">
            {t("description")}
          </p>
          <p
            className={cn(
              "text-xs tabular-nums",
              limitReached ? "text-warning" : "text-muted-foreground"
            )}
          >
            {limitReached
              ? t("limitReached", { max: maxFields })
              : t("limit", { count: active.length, max: maxFields })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <Switch
              checked={showArchived}
              onCheckedChange={setShowArchived}
              aria-label={tc("showArchived")}
            />
            {tc("showArchived")}
          </label>
          {canManage && (
            <Button
              type="button"
              size="sm"
              disabled={limitReached}
              onClick={() => setDialog({})}
            >
              <Plus className="size-4" />
              {t("add")}
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ol className="divide-y rounded-md border">
          {visible.map((field) => {
            const index = active.findIndex((f) => f.id === field.id);
            return (
              <li
                key={field.id}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5",
                  field.isArchived && "opacity-60"
                )}
              >
                <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">
                  {index >= 0 ? index + 1 : "–"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{field.label}</span>
                    {field.isRequired && (
                      <Badge
                        variant="outline"
                        className="text-destructive border-destructive/40 h-5 font-normal"
                      >
                        {t("requiredMarker")}
                      </Badge>
                    )}
                    {field.isArchived && (
                      <Badge variant="secondary" className="h-5 font-normal">
                        {tc("archived")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {field.key} · {t(`types.${field.fieldType}`)}
                    {isOptionFieldType(field.fieldType) && field.options?.length
                      ? ` · ${field.options.join(", ")}`
                      : ""}
                  </p>
                </div>
                <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
                  {t("usage", { count: field.usageCount ?? 0 })}
                </span>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("moveUp")}
                      disabled={busy || field.isArchived || index <= 0}
                      onClick={() => move(field.id, -1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("moveDown")}
                      disabled={
                        busy || field.isArchived || index >= active.length - 1
                      }
                      onClick={() => move(field.id, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("edit")}
                      disabled={busy}
                      onClick={() => setDialog({ field })}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {field.isArchived ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={tc("restore")}
                        disabled={busy || limitReached}
                        onClick={() => run(() => restoreCustomField(field.id))}
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
                        onClick={() => run(() => archiveCustomField(field.id))}
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-muted-foreground text-xs">{t("archivedHint")}</p>

      {dialog && (
        <CustomFieldDialog
          key={dialog.field?.id ?? "new"}
          open
          onOpenChange={(o) => !o && setDialog(null)}
          field={dialog.field}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
