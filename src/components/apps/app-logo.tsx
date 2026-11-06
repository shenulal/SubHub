// src/components/apps/app-logo.tsx
"use client";

/**
 * App icon with an initial-letter fallback. Uses a plain <img> on purpose:
 * icons come from uploaded files (`/api/v1/app-logos/…`, session-protected),
 * the vendor catalog or any https URL an admin typed — none of which the
 * Next.js image optimiser can fetch or allow-list reliably. A broken link
 * falls back to the initial instead of a broken-image glyph.
 */
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface AppLogoProps {
  src: string | null | undefined;
  name: string;
  /** Tailwind size + radius classes, e.g. "size-9 rounded-md". */
  className?: string;
  /** Text size of the fallback initial. */
  fallbackClassName?: string;
}

export function AppLogo({
  src,
  name,
  className = "size-9 rounded-md",
  fallbackClassName = "text-[0.9375rem]",
}: AppLogoProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <span
        aria-hidden
        data-testid="app-logo-fallback"
        className={cn(
          "tonal-primary flex shrink-0 items-center justify-center font-medium",
          className,
          fallbackClassName
        )}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        "bg-background shrink-0 border object-contain p-0.5",
        className
      )}
    />
  );
}
