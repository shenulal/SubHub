"use client";

import {
  deleteRole,
  resetSystemRole,
  type RolesPagePayload,
} from "@/actions/platform/roles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoleRow } from "@/types/platform";
import { Lock, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MemberRoleTable } from "./member-role-table";
import { RoleEditorDialog } from "./role-editor-dialog";

function RoleCard({
  role,
  onOpen,
  onReset,
  onDelete,
  busy,
}: {
  role: RoleRow;
  onOpen: () => void;
  onReset: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const t = useTranslations("platform.roles");
  return (
    <article
      className={cn(
        "group hover:border-primary/50 relative flex min-w-0 flex-col gap-3 rounded-md border p-4 transition-colors",
        role.isSystem && "border-dashed"
      )}
    >
      <header className="flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left whitespace-normal"
        >
          <h4 className="text-foreground flex min-w-0 items-center gap-1.5 text-[0.9375rem] font-medium">
            {role.isSystem && (
              <Lock className="text-muted-foreground size-3.5 shrink-0" />
            )}
            <span className="truncate" title={role.name}>
              {role.name}
            </span>
          </h4>
          {role.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[0.8125rem]">
              {role.description}
            </p>
          )}
        </button>
        <Badge
          variant={role.isSystem ? "secondary" : "primary"}
          className="shrink-0 text-[10px]"
        >
          {role.isSystem ? t("system") : t("custom")}
        </Badge>
      </header>
      <div className="text-muted-foreground mt-auto flex min-w-0 items-center justify-between gap-2 text-[0.8125rem]">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <Users className="size-3.5 shrink-0" />
          {t("memberCount", { count: role.memberCount })}
        </span>
        <span className="shrink-0 tabular-nums">
          {t("grantCount", { count: role.permissionKeys.length })}
        </span>
      </div>
      <div className="-mx-1 -mb-1 flex flex-wrap gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onOpen}>
          {role.isSystem ? t("view") : t("edit")}
        </Button>
        {role.isSystem ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                <RotateCcw className="size-3.5" />
                {t("resetTemplate")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("resetTemplateTitle", { name: role.name })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("resetTemplateDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>
                  {t("resetTemplate")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
                {t("delete")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("deleteTitle", { name: role.name })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteDescription", { count: role.memberCount })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </article>
  );
}

export function RolesPageClient({ payload }: { payload: RolesPagePayload }) {
  const t = useTranslations("platform.roles");
  const router = useRouter();
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const run = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    okMessage: string
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(okMessage);
        router.refresh();
      } else toast.error(result.error ?? t("saveFailed"));
    });

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="text-foreground text-lg leading-snug font-medium">
              {t("title")}
            </h3>
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("description")}
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("createRole")}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {payload.roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              busy={isPending}
              onOpen={() => {
                setEditing(role);
                setOpen(true);
              }}
              onReset={() =>
                run(() => resetSystemRole(role.id), t("resetDone"))
              }
              onDelete={() => run(() => deleteRole(role.id), t("deleted"))}
            />
          ))}
        </div>
      </section>

      <section className="border-t pt-6">
        <div className="mb-5 space-y-1">
          <h3 className="text-foreground text-lg leading-snug font-medium">
            {t("membersTitle")}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("membersDescription")}
          </p>
        </div>
        <MemberRoleTable members={payload.members} roles={payload.roles} />
      </section>

      <RoleEditorDialog
        open={open}
        onOpenChange={setOpen}
        role={editing}
        groups={payload.permissionGroups}
      />
    </div>
  );
}
