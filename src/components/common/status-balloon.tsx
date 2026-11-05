"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * StatusBalloon variant type
 * - excellent: 👍 Excellent!
 * - perfect: 😍 Perfect!
 * - outstanding: 🏆 Outstanding!
 */
export type StatusBalloonVariant = "excellent" | "perfect" | "outstanding";

interface StatusBalloonProps {
  variant: StatusBalloonVariant;
  className?: string;
}

const BALLOON_EMOJI: Record<StatusBalloonVariant, string> = {
  excellent: "👍",
  perfect: "😍",
  outstanding: "🏆",
};

/**
 * StatusBalloon
 * Status speech-bubble component based on the Figma design
 * - Triangular arrow on the left
 * - White background + shadow
 * - Emoji + text (i18n)
 */
export function StatusBalloon({ variant, className }: StatusBalloonProps) {
  const t = useTranslations("common.statusBalloon");

  const emoji = BALLOON_EMOJI[variant];
  const text = t(variant);

  return (
    <div className={cn("flex items-center", className)}>
      {/* Left triangular arrow */}
      <div className="border-r-card border-y-[5px] border-r-[6px] border-y-transparent" />
      {/* Speech-bubble box */}
      <div className="bg-card flex h-[22px] items-center rounded px-2 shadow-sm">
        <span className="text-muted-foreground text-[12px] leading-none whitespace-nowrap">
          {emoji} {text}
        </span>
      </div>
    </div>
  );
}
