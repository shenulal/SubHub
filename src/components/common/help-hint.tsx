// src/components/common/help-hint.tsx
"use client";

/**
 * Contextual help (11.4): a small icon that reveals a short explanation and an
 * optional "Learn more" link. Hover shows a tooltip; click/tap opens a popover
 * so the content is reachable on touch devices and by keyboard.
 */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CircleHelp, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export interface HelpHintProps {
  /** Optional heading inside the popover. */
  title?: string;
  /** Explanation (plain text or small inline markup). */
  content: ReactNode;
  /** "Learn more" destination (internal path or absolute URL). */
  href?: string;
  /** Accessible label for the trigger; defaults to the title or a generic label. */
  label?: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function HelpHint({
  title,
  content,
  href,
  label,
  className,
  side = "top",
}: HelpHintProps) {
  const t = useTranslations("notifications.help");
  const ariaLabel = label ?? title ?? t("ariaLabel");
  const isExternal = href?.startsWith("http");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          title={title ?? ariaLabel}
          className={cn(
            "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
            className
          )}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="w-72 space-y-2 p-3 text-sm leading-relaxed shadow-lg"
      >
        {title && <p className="text-foreground font-medium">{title}</p>}
        <div className="text-muted-foreground">{content}</div>
        {href && (
          <a
            href={href}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
            className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            {t("learnMore")}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
