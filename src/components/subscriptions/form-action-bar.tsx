// src/components/subscriptions/form-action-bar.tsx
"use client";

/**
 * Sticky footer for long forms: the primary action stays visible while the
 * user scrolls, shows progress and cannot be pressed twice.
 */
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface FormActionBarProps {
  hint?: string;
  cancelLabel: string;
  submitLabel: string;
  isPending: boolean;
  onCancel: () => void;
  /** Submit a form by id when the bar is rendered outside the <form>. */
  formId?: string;
  className?: string;
}

export function FormActionBar({
  hint,
  cancelLabel,
  submitLabel,
  isPending,
  onCancel,
  formId,
  className,
}: FormActionBarProps) {
  return (
    <div
      data-testid="form-action-bar"
      className={cn(
        "bg-card/95 sticky bottom-0 z-20 -mx-1 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-t-md border-t px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.12)] backdrop-blur-sm",
        className
      )}
    >
      {hint && (
        <p className="text-muted-foreground mr-auto min-w-0 truncate text-[0.8125rem]">
          {hint}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isPending}
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        form={formId}
        disabled={isPending}
        aria-busy={isPending}
      >
        {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  );
}

function fieldElement(fieldName: string): HTMLElement | null {
  const safeName =
    typeof CSS !== "undefined" && CSS.escape
      ? CSS.escape(fieldName)
      : fieldName;
  return (
    document.getElementById(fieldName) ??
    document.querySelector<HTMLElement>(`[name="${safeName}"]`)
  );
}

/**
 * Scroll to and focus the invalid field that comes first on the page, so the
 * error is never off-screen. Returns the field name it chose (or the first key
 * when none of the fields can be located).
 */
export function focusFirstInvalid(fieldNames: string[]): string | undefined {
  if (fieldNames.length === 0 || typeof document === "undefined")
    return undefined;
  const located = fieldNames
    .map((name) => ({ name, el: fieldElement(name) }))
    .filter((x): x is { name: string; el: HTMLElement } => Boolean(x.el))
    .sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1
    );
  const first = located[0];
  if (!first) return fieldNames[0];
  first.el.scrollIntoView?.({ block: "center", behavior: "smooth" });
  first.el.focus?.({ preventScroll: true });
  return first.name;
}
