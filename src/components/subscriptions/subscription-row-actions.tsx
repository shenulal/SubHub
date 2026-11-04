// src/components/subscriptions/subscription-row-actions.tsx
"use client";

/**
 * Per-row actions menu: edit, pause/resume, archive/restore, delete.
 * Lifecycle transitions come from the Lifecycle agent's actions and every
 * entry is gated by `<Can>`; the server re-checks on each call.
 */
import { deleteSubscription } from "@/actions/subscriptions";
import {
  archiveSubscription,
  pauseSubscription,
  restoreSubscription,
  resumeSubscription,
} from "@/actions/subscriptions/subscription-lifecycle";
import { Can } from "@/components/common/can";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DiscoverySubscriptionItem } from "@/types/discovery";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

type LifecycleFn = (
  id: string
) => Promise<{ success: boolean; error?: string; message?: string }>;

interface SubscriptionRowActionsProps {
  subscription: DiscoverySubscriptionItem;
  onChanged?: () => void;
}

export function SubscriptionRowActions({
  subscription,
  onChanged,
}: SubscriptionRowActionsProps) {
  const t = useTranslations("discovery.rowActions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = (fn: LifecycleFn, successKey: string) => {
    startTransition(async () => {
      try {
        const result = await fn(subscription.id);
        if (result?.success) {
          toast.success(t(successKey, { appName: subscription.appName }));
          onChanged?.();
          router.refresh();
        } else {
          toast.error(result?.error ?? result?.message ?? t("failed"));
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("failed"));
      }
    });
  };

  const { status } = subscription;
  const isArchived = status === "ARCHIVED";
  const isPaused = status === "PAUSED";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isPending}
            aria-label={t("open", { appName: subscription.appName })}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/subscriptions/${subscription.id}`}>{t("view")}</Link>
          </DropdownMenuItem>
          <Can permission="subscriptions:update">
            <DropdownMenuItem asChild disabled={isPending}>
              <Link href={`/subscriptions/${subscription.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("edit")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isArchived && !isPaused && (
              <DropdownMenuItem
                disabled={isPending || status !== "ACTIVE"}
                onSelect={() => run(pauseSubscription, "paused")}
              >
                <Pause className="mr-2 h-4 w-4" />
                {t("pause")}
              </DropdownMenuItem>
            )}
            {isPaused && (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => run(resumeSubscription, "resumed")}
              >
                <Play className="mr-2 h-4 w-4" />
                {t("resume")}
              </DropdownMenuItem>
            )}
            {!isArchived ? (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => run(archiveSubscription, "archived")}
              >
                <Archive className="mr-2 h-4 w-4" />
                {t("archive")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={isPending}
                onSelect={() => run(restoreSubscription, "restored")}
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                {t("restore")}
              </DropdownMenuItem>
            )}
          </Can>
          <Can permission="subscriptions:delete">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isPending}
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("delete")}
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", { appName: subscription.appName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                setConfirmDelete(false);
                run(deleteSubscription as LifecycleFn, "deleted");
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
