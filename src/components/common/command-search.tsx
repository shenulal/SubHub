"use client";

/**
 * Cmd+K command palette (9.1): debounced, permission-aware server search
 * grouped as Subscriptions / Approvals / Vendors / People / Pages / Actions,
 * keyboard navigation (cmdk) and recent searches in localStorage.
 */
import { globalSearch } from "@/actions/discovery/search";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  GlobalSearchResult,
  SearchGroupKey,
  SearchResultItem,
} from "@/types/discovery";
import {
  AppWindow,
  ClipboardCheck,
  CreditCard,
  History,
  Loader2,
  Search,
  Store,
  Users,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as React from "react";

const RECENT_KEY = "subhub.recentSearches";
/** Fallbacks until the first server response carries the org settings. */
const DEFAULT_DEBOUNCE_MS = 250;
const DEFAULT_MIN_CHARS = 2;
const DEFAULT_RECENT_LIMIT = 5;

const GROUP_ICONS: Record<SearchGroupKey, typeof Search> = {
  subscriptions: CreditCard,
  approvals: ClipboardCheck,
  vendors: Store,
  people: Users,
  pages: AppWindow,
  actions: Zap,
};

export function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(term: string, limit: number): string[] {
  const next = [term, ...readRecentSearches().filter((t) => t !== term)].slice(
    0,
    limit
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode / blocked storage: recents are a convenience only.
  }
  return next;
}

interface CommandSearchProps {
  /** Injected for tests; defaults to the server action. */
  search?: (
    query: string
  ) => Promise<{ success: boolean; data?: GlobalSearchResult; error?: string }>;
}

export function CommandSearch({
  search = (q) => globalSearch(q),
}: CommandSearchProps) {
  const t = useTranslations("discovery.search");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<GlobalSearchResult | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [recent, setRecent] = React.useState<string[]>([]);
  const metaRef = React.useRef({
    debounceMs: DEFAULT_DEBOUNCE_MS,
    minChars: DEFAULT_MIN_CHARS,
    recentLimit: DEFAULT_RECENT_LIMIT,
  });
  const requestId = React.useRef(0);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    if (open) setRecent(readRecentSearches());
  }, [open]);

  // Debounced server search; the catalogue (pages/actions) still answers for short queries.
  React.useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setIsPending(true);
    const handle = setTimeout(
      async () => {
        try {
          const res = await search(query);
          if (id !== requestId.current) return;
          if (res.success && res.data) {
            setResult(res.data);
            metaRef.current = {
              debounceMs: metaRef.current.debounceMs,
              minChars: res.data.meta.minChars,
              recentLimit: res.data.meta.recentSearchesLimit,
            };
          } else {
            setResult(null);
          }
        } catch {
          if (id === requestId.current) setResult(null);
        } finally {
          if (id === requestId.current) setIsPending(false);
        }
      },
      query ? metaRef.current.debounceMs : 0
    );
    return () => clearTimeout(handle);
  }, [query, open, search]);

  const handleSelect = (item: SearchResultItem) => {
    if (query.trim())
      setRecent(pushRecentSearch(query.trim(), metaRef.current.recentLimit));
    setOpen(false);
    setQuery("");
    router.push(item.href);
  };

  const groups = result?.groups ?? [];
  const showRecent = !query && recent.length > 0;
  const tooShort = query.length > 0 && query.length < metaRef.current.minChars;

  return (
    <>
      <Button
        variant="outline"
        className="bg-muted/50 text-muted-foreground relative h-9 w-full justify-start rounded-md text-sm font-normal shadow-none sm:pr-12 md:w-64 lg:w-80"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
      >
        <Search className="mr-2 h-4 w-4" />
        {t("placeholder")}
        <kbd className="bg-muted pointer-events-none absolute top-1.5 right-1.5 hidden h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden p-0 sm:max-w-xl"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("open")}</DialogTitle>
            <DialogDescription>{t("inputPlaceholder")}</DialogDescription>
          </DialogHeader>
          {/* Server results are already ranked; disable cmdk's client filter. */}
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
          >
            <CommandInput
              placeholder={t("inputPlaceholder")}
              value={query}
              onValueChange={setQuery}
              aria-label={t("inputPlaceholder")}
            />
            <CommandList>
              {isPending && (
                <div
                  className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs"
                  data-testid="search-pending"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("searching")}
                </div>
              )}
              {!isPending && groups.length === 0 && !showRecent && (
                <CommandEmpty>
                  {tooShort
                    ? t("typeMore", { count: metaRef.current.minChars })
                    : t("empty")}
                </CommandEmpty>
              )}
              {showRecent && (
                <CommandGroup heading={t("recent")}>
                  {recent.map((term) => (
                    <CommandItem
                      key={term}
                      value={`recent-${term}`}
                      onSelect={() => setQuery(term)}
                      className="cursor-pointer"
                    >
                      <History className="text-muted-foreground mr-2 h-4 w-4" />
                      {term}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groups.map((group, index) => {
                const Icon = GROUP_ICONS[group.key];
                return (
                  <React.Fragment key={group.key}>
                    {(index > 0 || showRecent) && <CommandSeparator />}
                    <CommandGroup heading={t(`groups.${group.key}`)}>
                      {group.items.map((item) => (
                        <CommandItem
                          key={`${group.key}-${item.id}`}
                          value={`${group.key}-${item.id}`}
                          onSelect={() => handleSelect(item)}
                          className="cursor-pointer gap-2"
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-5 w-5 rounded-sm object-contain"
                            />
                          ) : (
                            <Icon className="text-muted-foreground h-4 w-4" />
                          )}
                          <span className="truncate">
                            {item.labelKey
                              ? t(`catalog.${item.labelKey}`)
                              : item.title}
                          </span>
                          {item.subtitle && (
                            <span className="text-muted-foreground ml-auto truncate text-xs">
                              {item.subtitle}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </React.Fragment>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
