// src/components/notifications/onboarding-checklist.tsx
"use client";

/**
 * Onboarding checklist (11.3) — mounted on the dashboard by the Discovery
 * area. Renders nothing once dismissed or fully complete.
 */
import {
  dismissOnboarding,
  getOnboardingProgress,
} from "@/actions/notifications/onboarding";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { OnboardingProgressView } from "@/types/notification";
import { ArrowRight, Check, Rocket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

export interface OnboardingChecklistProps {
  /** Pre-loaded progress (server component) — skips the client fetch. */
  initialProgress?: OnboardingProgressView | null;
  className?: string;
}

export function OnboardingChecklist({
  initialProgress,
  className,
}: OnboardingChecklistProps) {
  const t = useTranslations("notifications.onboarding");
  const [progress, setProgress] = useState<OnboardingProgressView | null>(
    initialProgress ?? null
  );
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialProgress !== undefined) return;
    let cancelled = false;
    getOnboardingProgress().then((res) => {
      if (!cancelled && res.success && res.data) setProgress(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [initialProgress]);

  if (
    !progress ||
    progress.dismissed ||
    hidden ||
    progress.completed === progress.total
  ) {
    return null;
  }

  function handleDismiss() {
    setHidden(true);
    startTransition(async () => {
      const res = await dismissOnboarding();
      if (!res.success) setHidden(false);
    });
  }

  return (
    <section
      aria-labelledby="onboarding-heading"
      className={cn(
        "bg-card text-card-foreground relative overflow-hidden rounded-lg p-5 shadow-md sm:p-6",
        "before:from-primary/10 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-40 before:bg-gradient-to-r before:to-transparent",
        className
      )}
    >
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Rocket className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="onboarding-heading"
              className="text-foreground text-lg leading-snug font-medium"
            >
              {t("title")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("progress", {
                completed: progress.completed,
                total: progress.total,
              })}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={t("dismiss")}
          onClick={handleDismiss}
          disabled={isPending}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Progress
        value={progress.percent}
        aria-label={t("progress", {
          completed: progress.completed,
          total: progress.total,
        })}
        className="relative mt-4 h-2"
      />

      <ol className="relative mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {progress.steps.map((step, index) => (
          <li key={step.key}>
            <Link
              href={step.href}
              aria-disabled={step.done}
              className={cn(
                "group flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                step.done
                  ? "bg-muted/60 text-muted-foreground border-transparent"
                  : "hover:border-primary/50 hover:bg-primary/[0.04]"
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums",
                  step.done ? "tonal-success" : "tonal-primary"
                )}
                aria-hidden="true"
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate leading-snug",
                  step.done && "line-through"
                )}
              >
                {t(`steps.${step.key}`)}
              </span>
              {!step.done && (
                <ArrowRight
                  className="text-primary h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
