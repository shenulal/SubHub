"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string | null;
  error?: string | null;
  placeholder?: string;
  showLabel: string;
  hideLabel: string;
  required?: boolean;
  minLength?: number;
}

/** Password input with a show/hide toggle, hint and inline error. */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  hint,
  error,
  placeholder,
  showLabel,
  hideLabel,
  required = true,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-[0.8125rem]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-[0.8125rem]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
