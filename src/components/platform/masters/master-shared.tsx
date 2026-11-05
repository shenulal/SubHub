"use client";

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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h3 className="text-foreground text-lg leading-snug font-medium">
          {title}
        </h3>
        <p className="text-muted-foreground text-[0.8125rem]">{description}</p>
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("platform.masters.common");
  return (
    <Badge
      variant={active ? "success" : "secondary"}
      className={cn("gap-1.5 font-medium", !active && "text-muted-foreground")}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          active ? "bg-success" : "bg-muted-foreground/50"
        )}
      />
      {active ? t("active") : t("inactive")}
    </Badge>
  );
}

export function DefaultBadge() {
  const t = useTranslations("platform.masters.common");
  return (
    <Badge variant="secondary" className="font-normal">
      {t("default")}
    </Badge>
  );
}

export function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-[0.8125rem] font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-[0.8125rem]">{hint}</p>}
    </div>
  );
}

export function ConfirmDelete({
  onConfirm,
  label,
  disabled,
}: {
  onConfirm: () => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations("platform.masters.common");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8"
          aria-label={t("delete")}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmDeleteDescription", { name: label })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const EMPTY_SELECT_VALUE = "__none__";

export function fromSelect(value: string): string | null {
  return value === EMPTY_SELECT_VALUE ? null : value;
}

export function toSelect(value: string | null | undefined): string {
  return value ?? EMPTY_SELECT_VALUE;
}
