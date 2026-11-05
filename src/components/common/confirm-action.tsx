// src/components/common/confirm-action.tsx
"use client";

/**
 * Wraps a trigger (usually a destructive button) in a confirmation dialog so
 * the action only runs after an explicit "Yes". Focus returns to the trigger.
 */
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";

interface ConfirmActionProps {
  /** The element that opens the dialog (rendered with `asChild`). */
  children: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmAction({
  children,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
}: ConfirmActionProps) {
  const t = useTranslations("shell.confirm");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              destructive && buttonVariants({ variant: "destructive" })
            )}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
