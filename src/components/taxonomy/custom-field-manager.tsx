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
import {
  MasterListNoMatches,
  MasterListToolbar,
  useMasterList,
} from "@/components/platform/masters/master-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const shown = showArchived ? fields : active;
  const list = useMasterList(shown, {
    searchText: (f) => [
      f.label,
      f.key,
      t(`types.${f.fieldType}`),
      ...(f.options ?? []),
    ],
  });
  const visible = list.visible;
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

      {shown.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <div>
          <MasterListToolbar list={list} searchPlaceholder={t("search")} />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 text-right">#</TableHead>
                  <TableHead>{t("labelLabel")}</TableHead>
                  <TableHead>{t("keyLabel")}</TableHead>
                  <TableHead className="w-32">{t("typeLabel")}</TableHead>
                  <TableHead className="hidden xl:table-cell">
                    {t("optionsLabel")}
                  </TableHead>
                  <TableHead className="w-28 text-right">
                    {tc("usage")}
                  </TableHead>
                  {canManage && (
                    <TableHead className="w-36 text-right">
                      {tc("actions")}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && (
                  <MasterListNoMatches colSpan={canManage ? 7 : 6} />
                )}
                {visible.map((field) => {
                  const index = active.findIndex((f) => f.id === field.id);
                  return (
                    <TableRow
                      key={field.id}
                      className={cn(field.isArchived && "opacity-60")}
                    >
                      <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                        {index >= 0 ? index + 1 : "–"}
                      </TableCell>
                      <TableCell>
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
                            <Badge
                              variant="secondary"
                              className="h-5 font-normal"
                            >
                              {tc("archived")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {field.key}
                      </TableCell>
                      <TableCell>{t(`types.${field.fieldType}`)}</TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-xs truncate text-xs xl:table-cell">
                        {isOptionFieldType(field.fieldType) &&
                        field.options?.length
                          ? field.options.join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                        {t("usage", { count: field.usageCount ?? 0 })}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
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
                                busy ||
                                field.isArchived ||
                                index >= active.length - 1
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
                                onClick={() =>
                                  run(() => restoreCustomField(field.id))
                                }
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
                                onClick={() =>
                                  run(() => archiveCustomField(field.id))
                                }
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
        </div>
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
