// src/components/taxonomy/category-badge.tsx
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface CategoryBadgeProps {
  category: { name: string; color: string | null } | null;
  parentName?: string | null;
  className?: string;
}

/** Colour-dotted badge for a category, optionally prefixed with its parent. */
export function CategoryBadge({
  category,
  parentName,
  className,
}: CategoryBadgeProps) {
  const t = useTranslations("taxonomy.common");
  if (!category) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-muted-foreground border-dashed font-normal",
          className
        )}
      >
        {t("uncategorised")}
      </Badge>
    );
  }
  const color = category.color ?? "var(--muted-foreground)";
  return (
    <Badge
      variant="outline"
      className={cn("bg-background/60 gap-1.5 pl-1.5 font-medium", className)}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}
      title={parentName ? `${parentName} › ${category.name}` : category.name}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full ring-2 ring-inset"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 0 2px color-mix(in oklab, ${color} 25%, transparent)`,
        }}
      />
      {parentName && (
        <span className="text-muted-foreground font-normal">
          {parentName} ›
        </span>
      )}
      <span>{category.name}</span>
    </Badge>
  );
}
