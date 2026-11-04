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
        "group bg-card relative flex flex-col gap-3 rounded-lg border p-4 transition-shadow hover:shadow-sm",
        role.isSystem && "border-dashed"
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="text-left">
          <h4 className="flex items-center gap-1.5 font-semibold">
            {role.isSystem && (
              <Lock className="text-muted-foreground h-3.5 w-3.5" />
            )}
            {role.name}
          </h4>
          {role.description && (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
              {role.description}
            </p>
          )}
        </button>
        <Badge
          variant={role.isSystem ? "secondary" : "outline"}
          className="shrink-0 text-[10px]"
        >
          {role.isSystem ? t("system") : t("custom")}
        </Badge>
      </header>
      <div className="text-muted-foreground mt-auto flex items-center justify-between text-xs">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {t("memberCount", { count: role.memberCount })}
        </span>
        <span className="tabular-nums">
          {t("grantCount", { count: role.permissionKeys.length })}
        </span>
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button variant="ghost" size="sm" onClick={onOpen}>
          {role.isSystem ? t("view") : t("edit")}
        </Button>
        {role.isSystem ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
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
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              {t("title")}
            </h3>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("createRole")}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <section>
        <div className="mb-4">
          <h3 className="text-base font-semibold tracking-tight">
            {t("membersTitle")}
          </h3>
          <p className="text-muted-foreground text-sm">
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
