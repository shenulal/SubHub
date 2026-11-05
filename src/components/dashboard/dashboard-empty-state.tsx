// src/components/dashboard/dashboard-empty-state.tsx
/**
 * Materio empty state for dashboard cards: centred muted icon tile and one
 * line of muted text. Fills the remaining card height so sibling cards keep
 * the same height whether or not they have data.
 */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  message: string;
  className?: string;
}

export function DashboardEmptyState({
  icon: Icon,
  message,
  className,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center",
        className
      )}
    >
      <span className="tonal-neutral flex size-12 items-center justify-center rounded-md">
        <Icon className="size-6" aria-hidden />
      </span>
      <p
        className="text-muted-foreground max-w-full truncate text-[0.8125rem]"
        title={message}
      >
        {message}
      </p>
    </div>
  );
}
