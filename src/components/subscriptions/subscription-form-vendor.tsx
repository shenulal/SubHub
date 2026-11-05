"use client";

/**
 * Vendor card: catalog autocomplete with free-text fallback, category
 * auto-suggestion on selection, status select and an inline duplicate warning.
 */
import { checkDuplicate } from "@/actions/subscriptions/subscription-lifecycle";
import { suggestCategory } from "@/actions/taxonomy/auto-categorize";
import { searchCatalog } from "@/actions/taxonomy/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SimilarSubscription } from "@/lib/services/subscription/duplicates";
import { cn } from "@/lib/utils";
import type { CatalogItemDto } from "@/types/taxonomy";
import { AlertTriangle, Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from "react-hook-form";
import type { SubscriptionFormValues } from "./subscription-form-schema";
import { getStatusOptions } from "./subscription-form.constants";

interface SubscriptionFormVendorProps {
  control: Control<SubscriptionFormValues>;
  setValue: UseFormSetValue<SubscriptionFormValues>;
  errors: FieldErrors<SubscriptionFormValues>;
  isPending: boolean;
  isEditing: boolean;
  /** Existing subscription id to exclude from duplicate matches. */
  excludeId?: string;
}

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function SubscriptionFormVendor({
  control,
  setValue,
  errors,
  isPending,
  isEditing,
  excludeId,
}: SubscriptionFormVendorProps) {
  const t = useTranslations();
  const tv = useTranslations("lifecycle.form.vendor");
  const appName = useWatch({ control, name: "appName" }) ?? "";
  const catalogId = useWatch({ control, name: "catalogId" }) ?? "";
  const appWebsite = useWatch({ control, name: "appWebsite" }) ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogItemDto[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [duplicates, setDuplicates] = useState<SimilarSubscription[]>([]);

  // Debounced catalog search
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
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, open]);

  const runDuplicateCheck = async (name: string, domain: string | null) => {
    if (!name.trim() || isEditing) return;
    const result = await checkDuplicate(name, domain, excludeId);
    setDuplicates(result.success && result.data ? result.data : []);
  };

  const applySuggestion = async (item: CatalogItemDto | null, name: string) => {
    if (!item) return;
    try {
      const suggestion = await suggestCategory({
        serviceName: name,
        catalogCategory: item.category,
        vendorDomain: item.website,
      });
      if (suggestion.categoryId) {
        setValue("categoryId", suggestion.categoryId, { shouldDirty: true });
      }
    } catch {
      // Suggestions are best-effort.
    }
  };

  const select = (item: CatalogItemDto | null, name: string) => {
    setValue("appName", name, { shouldDirty: true });
    setValue("catalogId", item?.id ?? "", { shouldDirty: true });
    setValue("appWebsite", item?.website ?? "", { shouldDirty: true });
    setValue("appLogoUrl", item?.logoUrl ?? "", { shouldDirty: true });
    setValue("appId", "", { shouldDirty: true });
    setOpen(false);
    setQuery("");
    void applySuggestion(item, name);
    void runDuplicateCheck(name, item?.website ?? null);
  };

  const clear = () => {
    select(null, "");
    setDuplicates([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("subscriptions.form.basicInfo.title")}</CardTitle>
        <CardDescription>{tv("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appName">
            {t("subscriptions.form.basicInfo.appSelect")}
          </Label>
          <div className="flex items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  id="appName"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="appName-catalog-list"
                  disabled={isPending || isEditing}
                  className={cn(
                    "border-input bg-background flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
                    "focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                    !appName && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">
                    {appName ||
                      t("subscriptions.form.basicInfo.appPlaceholder")}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={tv("placeholder")}
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList id="appName-catalog-list">
                    {isSearching && (
                      <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {tv("searching")}
                      </div>
                    )}
                    <CommandEmpty>{tv("noResults")}</CommandEmpty>
                    {query.trim().length > 0 && (
                      <CommandGroup>
                        <CommandItem
                          value={`__free__${query}`}
                          onSelect={() => select(null, query.trim())}
                        >
                          {tv("useName", { name: query.trim() })}
                        </CommandItem>
                      </CommandGroup>
                    )}
                    {results.length > 0 && (
                      <CommandGroup>
                        {results.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={item.id}
                            onSelect={() => select(item, item.name)}
                            className="flex items-center gap-2"
                          >
                            {item.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.logoUrl}
                                alt=""
                                className="h-5 w-5 rounded-sm object-contain"
                              />
                            ) : (
                              <span className="bg-muted h-5 w-5 rounded-sm" />
                            )}
                            <span className="flex-1 truncate">{item.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {item.category}
                            </span>
                            {catalogId === item.id && (
                              <Check className="h-4 w-4" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {appName && !isEditing && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={clear}
                aria-label={tv("clear")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {catalogId && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Badge variant="outline">{tv("selected")}</Badge>
              {appWebsite && <span className="truncate">{appWebsite}</span>}
            </div>
          )}
          {errors.appName?.message && (
            <p className="text-destructive text-sm">
              {errors.appName.message.toString()}
            </p>
          )}
          {errors.appId?.message && (
            <p className="text-destructive text-sm">
              {errors.appId.message.toString()}
            </p>
          )}
        </div>

        {duplicates.length > 0 && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 text-foreground space-y-2 rounded-md border px-4 py-3 text-sm"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {tv("duplicateTitle")}
            </p>
            <p className="text-xs opacity-80">{tv("duplicateDescription")}</p>
            <ul className="space-y-1">
              {duplicates.map((d) => (
                <li key={d.subscriptionId}>
                  <Link
                    href={`/subscriptions/${d.subscriptionId}`}
                    className="underline underline-offset-4"
                    target="_blank"
                  >
                    {tv("duplicateMatch", {
                      name: d.appName,
                      status: d.status,
                      similarity: Math.round(d.similarity * 100),
                      reason: tv(`reasons.${d.reason}`),
                    })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label>{t("subscriptions.form.status.title")}</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                value={field.value ?? "ACTIVE"}
                onValueChange={field.onChange}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("subscriptions.form.status.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {getStatusOptions(t).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
