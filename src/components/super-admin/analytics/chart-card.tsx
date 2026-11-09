// src/components/super-admin/analytics/chart-card.tsx
/** Card frame shared by the analytics charts: title, caption, body, empty state. */
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface ChartCardProps {
  title: string;
  caption?: string;
  /** Rendered instead of the body when set. */
  empty?: { icon: LucideIcon; message: string } | null;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  testId?: string;
}

export function ChartCard({
  title,
  caption,
  empty,
  actions,
  className,
  children,
  testId,
}: ChartCardProps) {
  return (
    <Card
      className={cn("min-w-0 gap-4 overflow-clip px-5", className)}
      data-testid={testId}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p
            className="text-foreground truncate text-lg font-medium"
            title={title}
          >
            {title}
          </p>
          {caption && (
            <p
              className="text-muted-foreground truncate text-[0.8125rem]"
              title={caption}
            >
              {caption}
            </p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {empty ? (
        <DashboardEmptyState icon={empty.icon} message={empty.message} />
      ) : (
        children
      )}
    </Card>
  );
}
