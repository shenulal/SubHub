// src/components/taxonomy/tag-input.tsx
"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { searchTags } from "@/actions/taxonomy/tags";
import { cn } from "@/lib/utils";
import type { TagDto } from "@/types/taxonomy";

const SEARCH_DEBOUNCE_MS = 150;
const SUGGESTION_LIMIT = 8;

export interface TagInputProps {
  /** Tag names currently applied. */
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Override the suggestion source (tests / storybook). */
  search?: (query: string, limit?: number) => Promise<TagDto[]>;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function TagChip({
  name,
  color,
  onRemove,
  disabled,
}: {
  name: string;
  color?: string | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("taxonomy.tags");
  return (
    <span
      className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md border py-0.5 pr-1 pl-2 text-xs font-medium"
      style={
        color
          ? { borderColor: `color-mix(in oklab, ${color} 50%, transparent)` }
          : undefined
      }
    >
      {color && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {name}
      <button
        type="button"
        aria-label={t("remove", { name })}
        onClick={onRemove}
        disabled={disabled}
        className="hover:bg-foreground/10 rounded-sm p-0.5 transition-colors disabled:opacity-50"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/** Chip input with autocomplete and create-on-enter. Values are tag names. */
export function TagInput({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  search = searchTags,
}: TagInputProps) {
  const t = useTranslations("taxonomy.tags");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TagDto[]>([]);
  const [knownColors, setKnownColors] = useState<Record<string, string | null>>(
    {}
  );
  const [active, setActive] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      search(query, SUGGESTION_LIMIT)
        .then((tags) => {
          if (cancelled) return;
          setSuggestions(
            tags.filter((tag) => !value.some((v) => sameName(v, tag.name)))
          );
          setKnownColors((prev) => ({
            ...prev,
            ...Object.fromEntries(
              tags.map((tag) => [tag.name.toLowerCase(), tag.color])
            ),
          }));
          setActive(0);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, isOpen, value, search]);

  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 0 &&
    !value.some((v) => sameName(v, trimmed)) &&
    !suggestions.some((s) => sameName(s.name, trimmed));
  const options = [
    ...suggestions.map((s) => s.name),
    ...(canCreate ? [trimmed] : []),
  ];

  const add = (name: string) => {
    if (!name.trim() || value.some((v) => sameName(v, name))) return;
    onChange([...value, name.trim()]);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };
  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || (e.key === "," && trimmed)) {
      e.preventDefault();
      const pick = options[active] ?? trimmed;
      if (pick) add(pick);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "Backspace" && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "border-input bg-background focus-within:ring-ring/50 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 shadow-xs transition-[box-shadow] focus-within:ring-[3px]",
          disabled && "opacity-60"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name) => (
          <TagChip
            key={name}
            name={name}
            color={knownColors[name.toLowerCase()]}
            onRemove={() => remove(name)}
            disabled={disabled}
          />
        ))}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={isOpen && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          placeholder={
            value.length === 0 ? (placeholder ?? t("placeholder")) : undefined
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
      </div>
      {isOpen && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s.name)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                {s.color && (
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                )}
                {s.name}
              </span>
              {typeof s.usageCount === "number" && (
                <span className="text-muted-foreground text-xs">
                  {s.usageCount}
                </span>
              )}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === suggestions.length}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(trimmed)}
              onMouseEnter={() => setActive(suggestions.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                active === suggestions.length &&
                  "bg-accent text-accent-foreground"
              )}
            >
              <Plus className="size-3.5" />
              {t("createNew", { name: trimmed })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
