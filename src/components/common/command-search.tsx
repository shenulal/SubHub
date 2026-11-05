"use client";

/**
 * Cmd+K command palette (9.1): debounced, permission-aware server search
 * grouped as Subscriptions / Approvals / Vendors / People / Pages / Actions,
 * keyboard navigation (cmdk) and recent searches in localStorage.
 */
import { globalSearch } from "@/actions/discovery/search";
import { useQuickCreate } from "@/components/common/quick-create/quick-create-context";
import {
  allowedQuickCreateEntries,
  matchesQuickCreate,
  type QuickCreateEntry,
  type QuickCreateKind,
} from "@/components/common/quick-create/quick-create-registry";
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
import { useSafePermissions } from "@/hooks/use-permission-flag";
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

/** Server "action" entries that the client-side Create group replaces. */
const ACTION_DUPLICATES: Record<string, QuickCreateKind> = {
  "action-new-subscription": "subscription",
  "action-new-approval": "approval",
  "action-invite": "invite",
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
  const tq = useTranslations("shell.quickCreate");
  const router = useRouter();
  const quickCreate = useQuickCreate();
  const { can } = useSafePermissions();
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

  const createEntries = allowedQuickCreateEntries(can).filter((entry) =>
    matchesQuickCreate(entry, tq(`items.${entry.kind}`), query)
  );
  const createKinds = new Set(createEntries.map((e) => e.kind));
  const groups = (result?.groups ?? [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const kind = ACTION_DUPLICATES[item.id];
        return !kind || !createKinds.has(kind);
      }),
    }))
    .filter((group) => group.items.length > 0);
  const showRecent = !query && recent.length > 0;

  const handleCreate = (entry: QuickCreateEntry) => {
    setOpen(false);
    setQuery("");
    if (quickCreate) quickCreate.open(entry.kind);
    else router.push(entry.href ?? entry.manageHref);
  };
  const tooShort = query.length > 0 && query.length < metaRef.current.minChars;

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground hover:text-foreground relative h-10 w-full justify-start gap-3 rounded-md border-transparent bg-transparent px-2 text-[0.9375rem] font-normal shadow-none hover:border-transparent hover:bg-transparent sm:pr-14 md:w-64 lg:w-80 [&_svg:not([class*='size-'])]:size-5"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
      >
        <Search className="size-5" />
        <span className="truncate">{t("placeholder")}</span>
        <kbd className="tonal-neutral pointer-events-none absolute top-1/2 right-2 hidden h-6 -translate-y-1/2 items-center gap-0.5 rounded px-1.5 font-sans text-xs font-medium select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-0 overflow-hidden rounded-lg p-0 shadow-xl sm:max-w-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("open")}</DialogTitle>
            <DialogDescription>{t("inputPlaceholder")}</DialogDescription>
          </DialogHeader>
          {/* Server results are already ranked; disable cmdk's client filter. */}
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item][data-selected=true]]:bg-primary/[0.08] [&_[cmdk-item][data-selected=true]]:text-primary [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-[0.9375rem] [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:text-[0.9375rem] [&_[cmdk-list]]:max-h-[min(60vh,420px)] [&_[cmdk-list]]:pb-2"
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
                  className="text-muted-foreground flex items-center gap-2 px-4 py-2.5 text-[0.8125rem]"
                  data-testid="search-pending"
                >
                  <Loader2 className="text-primary size-3.5 animate-spin" />
                  {t("searching")}
                </div>
              )}
              {!isPending &&
                groups.length === 0 &&
                createEntries.length === 0 &&
                !showRecent && (
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
                      <History className="text-muted-foreground mr-1 size-4" />
                      {term}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {createEntries.length > 0 && (
                <CommandGroup heading={t("groups.create")}>
                  {createEntries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <CommandItem
                        key={`create-${entry.kind}`}
                        value={`create-${entry.kind}`}
                        onSelect={() => handleCreate(entry)}
                        className="group/item min-w-0 cursor-pointer gap-3"
                      >
                        <span className="tonal-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 truncate">
                          {tq(`items.${entry.kind}`)}
                        </span>
                        {!entry.href && (
                          <span className="text-muted-foreground ml-auto shrink-0 text-[0.8125rem]">
                            {t("createHint")}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
              {groups.map((group, index) => {
                const Icon = GROUP_ICONS[group.key];
                return (
                  <React.Fragment key={group.key}>
                    {(index > 0 || showRecent || createEntries.length > 0) && (
                      <CommandSeparator />
                    )}
                    <CommandGroup heading={t(`groups.${group.key}`)}>
                      {group.items.map((item) => (
                        <CommandItem
                          key={`${group.key}-${item.id}`}
                          value={`${group.key}-${item.id}`}
                          onSelect={() => handleSelect(item)}
                          className="group/item min-w-0 cursor-pointer gap-3"
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="size-8 shrink-0 rounded-md object-contain"
                            />
                          ) : (
                            <span className="tonal-neutral group-data-[selected=true]/item:tonal-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                              <Icon className="size-4" />
                            </span>
                          )}
                          <span className="min-w-0 truncate">
                            {item.labelKey
                              ? t(`catalog.${item.labelKey}`)
                              : item.title}
                          </span>
                          {item.subtitle && (
                            <span className="text-muted-foreground ml-auto max-w-[40%] shrink-0 truncate text-[0.8125rem]">
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
