// src/components/subscriptions/subscription-form-vendor-list.tsx
"use client";

/**
 * Result list of the vendor combobox: the organisation's own apps first, then
 * vendor-catalog matches, then either "+ Create app …" (apps:manage) or the
 * free-text fallback that registers the vendor when the subscription is saved.
 */
import { AppLogo } from "@/components/apps/app-logo";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { CatalogItemDto } from "@/types/taxonomy";
import { Check, Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export interface VendorAppOption {
  id: string;
  name: string;
  /** Custom icon or the linked catalog logo. */
  logoUrl?: string | null;
}

/** How many of the organisation's apps the list shows at once. */
const OWN_APPS_LIMIT = 8;

export function filterOwnApps(
  apps: VendorAppOption[],
  query: string
): VendorAppOption[] {
  const q = query.trim().toLowerCase();
  return apps
    .filter((app) => !q || app.name.toLowerCase().includes(q))
    .slice(0, OWN_APPS_LIMIT);
}

interface VendorListProps {
  listId: string;
  query: string;
  apps: VendorAppOption[];
  results: CatalogItemDto[];
  isSearching: boolean;
  selectedAppId: string;
  selectedCatalogId: string;
  canCreateApp: boolean;
  onPickApp: (app: VendorAppOption) => void;
  onPickCatalog: (item: CatalogItemDto) => void;
  onUseName: (name: string) => void;
  onCreateApp: (name: string) => void;
}

function CatalogLogo({ url }: { url: string | null }) {
  if (!url) return <span className="bg-muted size-5 shrink-0 rounded-sm" />;
  // Catalog logos are remote, tiny and already sized; next/image adds nothing.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-5 rounded-sm object-contain" />;
}

export function VendorList(props: VendorListProps) {
  const t = useTranslations("lifecycle.form.vendor");
  const ti = useTranslations("shell.inline");
  const { query, apps, results, isSearching } = props;
  const typed = query.trim();
  const ownApps = filterOwnApps(apps, query);
  const exactOwn = apps.some(
    (a) => a.name.toLowerCase() === typed.toLowerCase()
  );

  return (
    <CommandList id={props.listId}>
      {isSearching && (
        <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
          <Loader2 className="size-3 animate-spin" />
          {t("searching")}
        </div>
      )}
      <CommandEmpty>{t("noResults")}</CommandEmpty>
      {ownApps.length > 0 && (
        <CommandGroup heading={ti("yourApps")}>
          {ownApps.map((app) => (
            <CommandItem
              key={app.id}
              value={`app-${app.id}`}
              onSelect={() => props.onPickApp(app)}
              className="flex min-w-0 items-center gap-2"
            >
              <AppLogo
                src={app.logoUrl}
                name={app.name}
                className="size-5 rounded-sm p-0"
                fallbackClassName="text-[0.6875rem]"
              />
              <span className="min-w-0 flex-1 truncate">{app.name}</span>
              {props.selectedAppId === app.id && <Check className="size-4" />}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {results.length > 0 && (
        <CommandGroup heading={ti("vendorCatalog")}>
          {results.map((item) => (
            <CommandItem
              key={item.id}
              value={`catalog-${item.id}`}
              onSelect={() => props.onPickCatalog(item)}
              className="flex min-w-0 items-center gap-2"
            >
              <CatalogLogo url={item.logoUrl} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {item.category}
              </span>
              {props.selectedCatalogId === item.id && (
                <Check className="size-4" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {typed.length > 0 && !exactOwn && (
        <CommandGroup>
          {props.canCreateApp ? (
            <CommandItem
              value={`__create__${typed}`}
              onSelect={() => props.onCreateApp(typed)}
              className="text-primary data-[selected=true]:bg-primary/10 font-medium"
            >
              <Plus className="size-4" />
              {ti("createApp", { name: typed })}
            </CommandItem>
          ) : (
            <CommandItem
              value={`__free__${typed}`}
              onSelect={() => props.onUseName(typed)}
            >
              {t("useName", { name: typed })}
            </CommandItem>
          )}
        </CommandGroup>
      )}
    </CommandList>
  );
}
