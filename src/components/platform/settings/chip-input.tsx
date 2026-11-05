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
        "border-input hover:border-foreground/60 focus-within:border-primary focus-within:ring-primary/20 flex min-h-10 min-w-0 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 transition-[color,box-shadow] focus-within:ring-[3px]",
        disabled && "opacity-60",
        className
      )}
    >
      {values.map((value) => (
        <Badge
          key={value}
          variant="primary"
          className="gap-1 pr-1 font-mono text-xs"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            disabled={disabled}
            onClick={() => onChange(values.filter((v) => v !== value))}
            className="hover:bg-primary/20 rounded-sm p-0.5"
          >
            <X className="size-3" />
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
        className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none hover:border-0 focus-visible:ring-0"
      />
    </div>
  );
}
