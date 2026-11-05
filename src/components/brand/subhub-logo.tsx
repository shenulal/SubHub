// src/components/brand/subhub-logo.tsx
// SubHub wordmark in the Materio style: gradient mark + medium-weight name.
// Text uses currentColor so it reads correctly in light and dark themes.
import { cn } from "@/lib/utils";

interface SubHubLogoProps {
  className?: string;
  /** Hide the wordmark and show the mark only (collapsed navigation). */
  markOnly?: boolean;
}

export function SubHubLogo({ className, markOnly = false }: SubHubLogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="SubHub"
      role="img"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_2px_4px_rgb(140_87_255/0.35)]"
      >
        <defs>
          <linearGradient id="subhub-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a379ff" />
            <stop offset="100%" stopColor="#8c57ff" />
          </linearGradient>
        </defs>
        <rect width="28" height="28" rx="8" fill="url(#subhub-mark)" />
        <rect
          x="6"
          y="9"
          width="10"
          height="9"
          rx="2.5"
          fill="rgba(255,255,255,0.35)"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth="1.2"
        />
        <rect x="11" y="6" width="11" height="9" rx="2.5" fill="#ffffff" />
        <circle
          cx="20"
          cy="20"
          r="3.2"
          fill="#c6abff"
          stroke="#ffffff"
          strokeWidth="1.2"
        />
      </svg>
      {!markOnly && (
        <span className="text-foreground text-[1.375rem] leading-none font-semibold tracking-[0.15px]">
          Sub<span className="text-primary">Hub</span>
        </span>
      )}
    </span>
  );
}
