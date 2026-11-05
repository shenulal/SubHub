// src/components/common/quick-create/form-bits.tsx
"use client";

/** Small shared form pieces: the required-field asterisk and an inline error line. */
import { useTranslations } from "next-intl";

export function RequiredMark() {
  const t = useTranslations("shell.form");
  return (
    <span className="text-destructive ml-0.5" aria-hidden title={t("required")}>
      *
    </span>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-[0.8125rem]">
      {message}
    </p>
  );
}
