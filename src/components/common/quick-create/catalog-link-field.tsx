// src/components/common/quick-create/catalog-link-field.tsx
"use client";

/**
 * Optional vendor-catalog link for the create-app dialog: a debounced search
 * over the global catalogue. Picking an entry lets the dialog prefill website.
 */
import { searchCatalog } from "@/actions/taxonomy/catalog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CatalogItemDto } from "@/types/taxonomy";
import { ChevronsUpDown, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface CatalogLinkFieldProps {
  id: string;
  value: CatalogItemDto | null;
  onChange: (item: CatalogItemDto | null) => void;
  initialQuery?: string;
  disabled?: boolean;
}

function useCatalogSearch(open: boolean, query: string) {
  const [results, setResults] = useState<CatalogItemDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  useEffect(() => {
    if (!open || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const items = await searchCatalog(query.trim());
        if (!cancelled) setResults(items);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, query]);
  return { results, isSearching };
}

export function CatalogLinkField({
  id,
  value,
  onChange,
  initialQuery = "",
  disabled,
}: CatalogLinkFieldProps) {
  const t = useTranslations("shell.createApp");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialQuery);
  const { results, isSearching } = useCatalogSearch(open, query);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            disabled={disabled}
            className={cn(
              "border-input bg-background flex h-10 w-full min-w-0 items-center justify-between rounded-md border px-3 text-sm",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
              !value && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {value
                ? t("catalogLinked", { name: value.name })
                : t("catalogPlaceholder")}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("catalogSearch")}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList id={`${id}-list`}>
              {isSearching && (
                <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
                  <Loader2 className="size-3 animate-spin" />
                </div>
              )}
              <CommandEmpty>{t("catalogEmpty")}</CommandEmpty>
              <CommandGroup>
                {results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {item.category}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label={t("catalogClear")}
          disabled={disabled}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
