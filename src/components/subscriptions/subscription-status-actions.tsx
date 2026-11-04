"use client";

/**
 * Header actions for a subscription: Edit, Pause/Resume, Archive/Restore,
 * Cancel and Delete. Visibility is permission-gated with <Can>; the server
 * re-checks every action.
 */
import {
  archiveSubscription,
  cancelSubscription,
  deleteSubscription,
  pauseSubscription,
  restoreSubscription,
  resumeSubscription,
} from "@/actions/subscriptions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toIsoDate } from "@/lib/services/subscription/contract-terms";
import type { ActionState } from "@/types";
import type { SubscriptionStatus } from "@prisma/client";
import {
  Archive,
  ArchiveRestore,
  Ban,
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

type LifecycleAction = "pause" | "resume" | "archive" | "restore" | "cancel";
type PendingAction = LifecycleAction | "delete";

interface SubscriptionStatusActionsProps {
  subscriptionId: string;
  appName: string;
  status: SubscriptionStatus;
  onChanged?: () => void;
}

const ICONS: Record<LifecycleAction, typeof Pause> = {
  pause: Pause,
  resume: Play,
  archive: Archive,
  restore: ArchiveRestore,
  cancel: Ban,
};

function availableActions(status: SubscriptionStatus): LifecycleAction[] {
  switch (status) {
    case "ACTIVE":
      return ["pause", "cancel", "archive"];
    case "PAUSED":
      return ["resume", "cancel", "archive"];
    case "PENDING":
      return ["cancel", "archive"];
    case "ARCHIVED":
      return ["restore"];
    default:
      return ["archive"];
  }
}

export function SubscriptionStatusActions({
  subscriptionId,
  appName,
  status,
  onChanged,
}: SubscriptionStatusActionsProps) {
  const t = useTranslations("lifecycle.actions");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(toIsoDate(new Date()));

  const run = (action: PendingAction) => {
    startTransition(async () => {
      let result: ActionState<unknown>;
      switch (action) {
        case "pause":
          result = await pauseSubscription(subscriptionId);
          break;
        case "resume":
          result = await resumeSubscription(subscriptionId);
          break;
        case "archive":
          result = await archiveSubscription(subscriptionId);
          break;
        case "restore":
          result = await restoreSubscription(subscriptionId);
          break;
        case "cancel":
          result = await cancelSubscription(subscriptionId, { effectiveDate });
          break;
        case "delete":
          result = await deleteSubscription(subscriptionId);
          break;
      }
      setPending(null);
      if (!result.success) {
        toast.error(result.error ?? result.message ?? t("error"));
        return;
      }
      if (action === "delete") {
        router.push("/subscriptions");
        return;
      }
      toast.success(
        t("success", { name: appName, action: t(`pastTense.${action}`) })
      );
      onChanged?.();
      router.refresh();
    });
  };

  const actions = availableActions(status);
  const primary = actions[0];
  const PrimaryIcon = ICONS[primary];

  return (
    <div className="flex items-center gap-2">
      <Can permission="subscriptions:update">
        <Button variant="outline" asChild>
          <Link href={`/subscriptions/${subscriptionId}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("edit")}
          </Link>
        </Button>
        <Button
          variant={primary === "restore" ? "default" : "secondary"}
          onClick={() => setPending(primary)}
          disabled={isPending}
        >
          <PrimaryIcon className="mr-2 h-4 w-4" />
          {t(primary)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label={t("more")}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.slice(1).map((action) => {
              const Icon = ICONS[action];
              return (
                <DropdownMenuItem
                  key={action}
                  onSelect={() => setPending(action)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {t(action)}
                </DropdownMenuItem>
              );
            })}
            <Can permission="subscriptions:delete">
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setPending("delete")}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            </Can>
          </DropdownMenuContent>
        </DropdownMenu>
      </Can>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending &&
                t("confirmTitle", { action: t(pending), name: appName })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && pending !== "delete"
                ? t(`${pending}Description`)
                : t("delete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending === "cancel" && (
            <div className="space-y-2">
              <Label htmlFor="cancel-effective-date">
                {t("effectiveDate")}
              </Label>
              <Input
                id="cancel-effective-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pending) run(pending);
              }}
              disabled={isPending}
              className={
                pending === "delete" || pending === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isPending ? t("working") : t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
