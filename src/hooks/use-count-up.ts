// src/hooks/use-count-up.ts
"use client";

import { animate } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  /** Final value */
  to: number;
  /** Animation start value (default: 0) */
  from?: number;
  /** Animation duration (seconds, default: 1) */
  duration?: number;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Use a thousands separator (default: true) */
  separator?: boolean;
  /** Prefix (e.g. "$", "AED ") */
  prefix?: string;
  /** Suffix (e.g. "%") */
  suffix?: string;
}

/**
 * Number count-up animation hook
 * Starts automatically when the element enters the viewport (uses IntersectionObserver)
 */
export function useCountUp({
  to,
  from = 0,
  duration = 1,
  decimals = 0,
  separator = true,
  prefix = "",
  suffix = "",
}: UseCountUpOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  const [displayValue, setDisplayValue] = useState(
    formatNumber(from, decimals, separator, prefix, suffix)
  );

  const startAnimation = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const controls = animate(from, to, {
      duration,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (latest) => {
        setDisplayValue(
          formatNumber(latest, decimals, separator, prefix, suffix)
        );
      },
    });

    return () => controls.stop();
  }, [to, from, duration, decimals, separator, prefix, suffix]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { rootMargin: "-50px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [startAnimation]);

  return { ref, displayValue };
}

function formatNumber(
  value: number,
  decimals: number,
  separator: boolean,
  prefix: string,
  suffix: string
): string {
  const rounded =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  const formatted = separator
    ? Number(rounded).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded;
  return `${prefix}${formatted}${suffix}`;
}
