"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

interface ChipInputProps {
  id: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Restrict entries to numbers (used for `number-list` settings) */
  numeric?: boolean;
  disabled?: boolean;
  className?: string;
}

const SEPARATORS = /[,\s]+/;

/**
 * Tag-style list editor: type, press Enter/comma to add; backspace removes
 * the last chip. Values are deduplicated and (for numeric mode) sorted.
 */
export function ChipInput({
  id,
  values,
  onChange,
  placeholder,
  numeric = false,
  disabled = false,
  className,
}: ChipInputProps) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(SEPARATORS)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const accepted = parts.filter(
      (p) => !numeric || Number.isFinite(Number(p))
    );
    const next = Array.from(new Set([...values, ...accepted]));
    onChange(numeric ? next.sort((a, b) => Number(a) - Number(b)) : next);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        "border-input bg-background focus-within:ring-ring flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2 focus-within:ring-offset-1",
        disabled && "opacity-60",
        className
      )}
    >
      {values.map((value) => (
        <Badge
          key={value}
          variant="secondary"
          className="gap-1 pr-1 font-mono text-xs"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            disabled={disabled}
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        inputMode={numeric ? "numeric" : "text"}
        placeholder={values.length === 0 ? placeholder : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
