"use client";

/**
 * MultiSelect — searchable dropdown that picks several values.
 *
 * Shares the look of the searchable Select: a 40px trigger showing the picked
 * values as chips (+N overflow), and a popover list with a search box, checkbox
 * rows, and "Select all" / "Clear" shortcuts. Optional `createOption` adds a
 * "+ Create …" row for inline master-data creation.
 */

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import {
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional group heading the option is listed under. */
  group?: string;
  disabled?: boolean;
  /** Extra words that should match this option in the search box. */
  keywords?: string[];
  icon?: React.ReactNode;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange(value: string[]): void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: React.ReactNode;
  /** Maximum chips shown in the trigger before collapsing into "+N". */
  maxChips?: number;
  /** Text used for the "+N" chip, receives the hidden count. */
  moreLabel?: (count: number) => string;
  selectAllLabel?: string;
  clearLabel?: string;
  disabled?: boolean;
  /** Hide the "Select all" shortcut (e.g. for very long lists). */
  hideSelectAll?: boolean;
  id?: string;
  name?: string;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  createOption?: {
    label: (query: string) => React.ReactNode;
    onCreate: (query: string) => void;
  };
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results found",
  maxChips = 2,
  moreLabel = (count) => `+${count}`,
  selectAllLabel = "Select all",
  clearLabel = "Clear",
  disabled,
  hideSelectAll,
  id,
  name,
  className,
  contentClassName,
  createOption,
  ...aria
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // Local mirror of `value`. Parents often apply the value asynchronously (e.g. via
  // URL search params), so rapid toggles must build on the latest *emitted*
  // selection rather than a stale prop, or earlier picks would be lost.
  const [current, setCurrent] = React.useState<string[]>(value);
  const pendingRef = React.useRef<string[]>([]);
  const valueKey = value.join("\u0000");
  React.useEffect(() => {
    const pending = pendingRef.current;
    const at = pending.indexOf(valueKey);
    if (at >= 0) {
      // An echo of something we emitted: drop it and anything older.
      pendingRef.current = pending.slice(at + 1);
      if (pendingRef.current.length === 0) setCurrent(value);
      return;
    }
    // External change (reset, saved view, navigation): adopt it.
    pendingRef.current = [];
    setCurrent(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueKey]);

  const emit = (next: string[]) => {
    pendingRef.current = [...pendingRef.current, next.join("\u0000")];
    setCurrent(next);
    onValueChange(next);
  };

  const selected = React.useMemo(() => new Set(current), [current]);
  const byValue = React.useMemo(
    () => new Map(options.map((o) => [o.value, o])),
    [options],
  );

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const toggle = (optionValue: string) => {
    const next = new Set(selected);
    if (next.has(optionValue)) next.delete(optionValue);
    else next.add(optionValue);
    // Keep the options' order for stable output
    emit(options.map((o) => o.value).filter((v) => next.has(v)));
  };

  const enabledValues = options.filter((o) => !o.disabled).map((o) => o.value);
  const allSelected =
    enabledValues.length > 0 && enabledValues.every((v) => selected.has(v));

  const groups = React.useMemo(() => {
    const map = new Map<string, MultiSelectOption[]>();
    for (const option of options) {
      const key = option.group ?? "";
      map.set(key, [...(map.get(key) ?? []), option]);
    }
    return [...map.entries()];
  }, [options]);

  const chips = current.slice(0, maxChips);
  const hidden = current.length - chips.length;

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(o) => !disabled && setOpen(o)}
      modal
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={aria["aria-label"]}
          aria-invalid={aria["aria-invalid"]}
          disabled={disabled}
          data-slot="multi-select-trigger"
          data-placeholder={current.length ? undefined : ""}
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20 aria-invalid:border-destructive hover:border-foreground/60 flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-left text-sm whitespace-nowrap outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {current.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : (
              <>
                {chips.map((v) => (
                  <span
                    key={v}
                    className="tonal-primary inline-flex max-w-[10rem] min-w-0 items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium"
                  >
                    <span className="truncate">
                      {byValue.get(v)?.label ?? v}
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove ${byValue.get(v)?.label ?? v}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!disabled) toggle(v);
                      }}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <XIcon className="size-3" />
                    </span>
                  </span>
                ))}
                {hidden > 0 ? (
                  <span className="tonal-neutral shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                    {moreLabel(hidden)}
                  </span>
                ) : null}
              </>
            )}
          </span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      {name
        ? current.map((v) => (
            <input key={v} type="hidden" name={name} value={v} />
          ))
        : null}
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          data-slot="multi-select-content"
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 z-50 w-(--radix-popover-trigger-width) min-w-[14rem] overflow-hidden rounded-md p-0 shadow-lg",
            contentClassName,
          )}
        >
          <CommandPrimitive
            loop
            className="flex max-h-[min(24rem,var(--radix-popover-content-available-height))] flex-col"
          >
            <div className="border-border flex items-center gap-2 border-b px-3">
              <SearchIcon className="text-muted-foreground size-4 shrink-0" />
              <CommandPrimitive.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="placeholder:text-muted-foreground h-10 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">
                {current.length} / {options.length}
              </span>
              <span className="flex items-center gap-3">
                {!hideSelectAll ? (
                  <button
                    type="button"
                    className="text-primary font-medium hover:underline disabled:opacity-50"
                    disabled={allSelected}
                    onClick={() => emit(enabledValues)}
                  >
                    {selectAllLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-muted-foreground font-medium hover:underline disabled:opacity-50"
                  disabled={current.length === 0}
                  onClick={() => emit([])}
                >
                  {clearLabel}
                </button>
              </span>
            </div>
            <CommandPrimitive.List
              role="listbox"
              aria-multiselectable="true"
              className="overflow-x-hidden overflow-y-auto p-1"
            >
              <CommandPrimitive.Empty className="text-muted-foreground py-5 text-center text-sm">
                {emptyText}
              </CommandPrimitive.Empty>
              {groups.map(([group, items]) => (
                <CommandPrimitive.Group
                  key={group || "__default"}
                  heading={group || undefined}
                  className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs"
                >
                  {items.map((option) => {
                    const isSelected = selected.has(option.value);
                    return (
                      <CommandPrimitive.Item
                        key={option.value}
                        value={`${option.label} ${option.value}`}
                        keywords={option.keywords}
                        disabled={option.disabled}
                        onSelect={() => toggle(option.value)}
                        data-slot="multi-select-item"
                        data-state={isSelected ? "checked" : "unchecked"}
                        className="data-[selected=true]:bg-accent flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-[0.9375rem] outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-foreground/40",
                          )}
                        >
                          {isSelected ? <CheckIcon className="size-3" /> : null}
                        </span>
                        {option.icon}
                        <span className="min-w-0 truncate">{option.label}</span>
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
              ))}
              {createOption ? (
                <CommandPrimitive.Item
                  value={`__create__ ${query}`}
                  forceMount
                  onSelect={() => createOption.onCreate(query.trim())}
                  data-slot="multi-select-create"
                  className="text-primary data-[selected=true]:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium outline-hidden select-none"
                >
                  <PlusIcon className="size-4" />
                  {createOption.label(query.trim())}
                </CommandPrimitive.Item>
              ) : null}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
