// src/components/super-admin/analytics/stat-tile.tsx
/** Materio statistic card: tonal icon tile → title → value → caption. */
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type Tone = "primary" | "success" | "warning" | "info" | "error";

const TONE_CLASS: Record<Tone, string> = {
  primary: "tonal-primary",
  success: "tonal-success",
  warning: "tonal-warning",
  info: "tonal-info",
  error: "tonal-error",
};

export interface StatTileProps {
  title: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  tone?: Tone;
}

export function StatTile({
  title,
  value,
  caption,
  icon: Icon,
  tone = "primary",
}: StatTileProps) {
  return (
    <Card data-testid="analytics-kpi">
      <CardContent className="flex min-w-0 flex-col gap-3">
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-md",
            TONE_CLASS[tone]
          )}
        >
          <Icon className="size-[22px]" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p
            className="text-muted-foreground truncate text-[0.8125rem]"
            title={title}
          >
            {title}
          </p>
          <div className="kpi-value text-foreground truncate" title={value}>
            {value}
          </div>
          <p
            className="text-muted-foreground truncate text-[0.8125rem]"
            title={caption}
          >
            {caption}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatGrid({ tiles }: { tiles: StatTileProps[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.title} {...tile} />
      ))}
    </div>
  );
}
