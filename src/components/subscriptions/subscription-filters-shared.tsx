// src/components/subscriptions/subscription-filters-shared.tsx
"use client";

/**
 * Small building blocks shared by the filter bar and bulk bar: a searchable
 * multi-select popover and a single-select popover with a "clear" row.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { NamedOption } from "@/types/discovery";
import { Check, ChevronDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

interface MultiSelectPopoverProps {
  label: string;
  options: NamedOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  searchPlaceholder?: string;
  /** Render option colour dot (tags/categories) */
  showColor?: boolean;
  className?: string;
}

export function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder,
  showColor,
  className,
}: MultiSelectPopoverProps) {
  const t = useTranslations("discovery.filters");
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: string) => {
    onChange(
      selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          className={cn(
            "h-10 shrink-0 gap-2 border-dashed px-4 text-[0.9375rem] font-normal whitespace-nowrap",
            selected.length > 0 &&
              "border-primary/50 bg-primary/5 text-primary border-solid",
            className
          )}
        >
          {label}
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="tonal-primary h-5 min-w-5 rounded-full px-1.5 text-[0.6875rem]"
            >
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="text-muted-foreground size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder ?? t("searchOptions")} />
          <CommandList>
            <CommandEmpty>{t("noOptions")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selectedSet.has(option.id);
                return (
                  <CommandItem
                    key={option.id}
                    value={option.name}
                    onSelect={() => toggle(option.id)}
                    className="cursor-pointer gap-2"
                  >
                    <span
                      className={cn(
                        "border-primary flex h-4 w-4 items-center justify-center rounded-sm border",
                        checked
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    {showColor && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: option.color ?? "var(--chart-2)" }}
                      />
                    )}
                    <span className="truncate">{option.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selected.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onChange([])}
                    className="text-muted-foreground cursor-pointer justify-center text-xs"
                  >
                    <X className="mr-1 h-3 w-3" />
                    {t("clear")}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface SingleSelectPopoverProps {
  label: string;
  options: NamedOption[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  className?: string;
}

export function SingleSelectPopover({
  label,
  options,
  value,
  onChange,
  className,
}: SingleSelectPopoverProps) {
  const t = useTranslations("discovery.filters");
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={label}
          className={cn(
            "h-10 max-w-64 min-w-0 gap-2 border-dashed px-4 text-[0.9375rem] font-normal whitespace-nowrap",
            current &&
              "border-primary/50 bg-primary/5 text-primary border-solid",
            className
          )}
        >
          <span className="truncate">
            {current ? `${label}: ${current.name}` : label}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t("searchOptions")} />
          <CommandList>
            <CommandEmpty>{t("noOptions")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.name}
                  onSelect={() => {
                    onChange(option.id === value ? undefined : option.id);
                    setOpen(false);
                  }}
                  className="cursor-pointer gap-2"
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5",
                      option.id === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {current && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onChange(undefined);
                      setOpen(false);
                    }}
                    className="text-muted-foreground cursor-pointer justify-center text-xs"
                  >
                    <X className="mr-1 h-3 w-3" />
                    {t("clear")}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
