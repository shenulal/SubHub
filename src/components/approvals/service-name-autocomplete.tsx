// src/components/approvals/service-name-autocomplete.tsx
"use client";

import { searchCatalog } from "@/actions/approvals/form-options";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CatalogSuggestion } from "@/types/approval";
import { Globe, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Debounce for catalogue lookups (UI constant). */
const SEARCH_DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

interface Props {
  id?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSelect: (item: CatalogSuggestion) => void;
  "aria-invalid"?: boolean;
  /** Optional last row ("+ Create app …") receiving the typed text. */
  createOption?: {
    label: (query: string) => React.ReactNode;
    onCreate: (query: string) => void;
  };
}

export function ServiceNameAutocomplete({
  id,
  value,
  placeholder,
  onChange,
  onSelect,
  createOption,
  ...rest
}: Props) {
  const [items, setItems] = useState<CatalogSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (value.trim().length < MIN_QUERY_LENGTH) {
      setItems([]);
      setOpen(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await searchCatalog(value.trim());
      const next = res.success && res.data ? res.data : [];
      setItems(next);
      setOpen(next.length > 0 || Boolean(createOption));
      setActive(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // createOption only toggles the extra row; re-searching on it is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const choose = (item: CatalogSuggestion) => {
    skipNext.current = true;
    onSelect(item);
    setOpen(false);
  };

  const rowCount = items.length + (createOption ? 1 : 0);
  const create = () => {
    setOpen(false);
    createOption?.onCreate(value.trim());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Enter" && createOption && active === items.length) {
      e.preventDefault();
      create();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id ?? "service"}-listbox`}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onFocus={() =>
          (items.length > 0 ||
            (createOption && value.trim().length >= MIN_QUERY_LENGTH)) &&
          setOpen(true)
        }
        {...rest}
      />
      {open && (
        <ul
          id={`${id ?? "service"}-listbox`}
          role="listbox"
          className="bg-popover text-popover-foreground border-border absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border p-1 shadow-md"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm",
                index === active ? "bg-accent text-accent-foreground" : ""
              )}
            >
              {item.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.logoUrl} alt="" className="h-6 w-6 rounded" />
              ) : (
                <span className="bg-muted flex h-6 w-6 items-center justify-center rounded">
                  <Globe className="text-muted-foreground h-3.5 w-3.5" />
                </span>
              )}
              <span className="flex-1 truncate font-medium">{item.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                {item.category}
              </span>
            </li>
          ))}
          {createOption && (
            <li
              role="option"
              aria-selected={active === items.length}
              onMouseDown={(e) => {
                e.preventDefault();
                create();
              }}
              onMouseEnter={() => setActive(items.length)}
              className={cn(
                "text-primary flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium",
                active === items.length ? "bg-primary/10" : ""
              )}
            >
              <Plus className="size-4" />
              {createOption.label(value.trim())}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
