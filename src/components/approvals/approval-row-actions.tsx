// src/components/approvals/approval-row-actions.tsx
"use client";

/**
 * Inline decision controls for a request row (inbox table, dashboard card):
 * Approve / Reject buttons plus a menu with Request info and Open. Rows the
 * viewer cannot decide only get the Open affordance.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ApprovalRequestListItem } from "@/types/approval";
import {
  Check,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  MoreVertical,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { DecisionKind } from "./decision/types";

interface ApprovalRowActionsProps {
  row: ApprovalRequestListItem;
  onDecide: (kind: DecisionKind, row: ApprovalRequestListItem) => void;
  /** Compact = icon-only buttons (dashboard card). */
  compact?: boolean;
  className?: string;
}

export function ApprovalRowActions({
  row,
  onDecide,
  compact = false,
  className,
}: ApprovalRowActionsProps) {
  const t = useTranslations("approvals.detail.actions");
  const td = useTranslations("approvals.decision");

  if (!row.canDecide) {
    return (
      <Button
        asChild
        variant="ghost"
        size="icon"
        className={cn("text-muted-foreground size-8", className)}
      >
        <Link
          href={`/approvals/${row.id}`}
          aria-label={td("open")}
          title={td("open")}
        >
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-1.5",
        className
      )}
    >
      <Button
        size="sm"
        onClick={() => onDecide("approve", row)}
        className={cn(
          "bg-success hover:bg-success/90 h-8 px-2.5 text-white",
          compact && "w-8 px-0"
        )}
        aria-label={`${t("approve")} ${row.serviceName}`}
        title={t("approve")}
      >
        <Check className={cn("size-4", !compact && "mr-1")} />
        {!compact && t("approve")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onDecide("reject", row)}
        // Icon-only keeps the row narrow; the label is in aria-label / title.
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 px-0"
        aria-label={`${t("reject")} ${row.serviceName}`}
        title={t("reject")}
      >
        <X className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={td("rowActions", { name: row.serviceName })}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onDecide("requestInfo", row)}>
            <HelpCircle className="mr-2 size-4" />
            {t("requestInfo")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/approvals/${row.id}`}>
              <ExternalLink className="mr-2 size-4" />
              {td("open")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
