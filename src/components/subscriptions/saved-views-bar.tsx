// src/components/subscriptions/saved-views-bar.tsx
"use client";

/**
 * Saved views (9.2): chips for own + shared views, "Save view" dialog and a
 * per-chip menu (set default, update with current filters, delete).
 */
import {
  createSavedView,
  deleteSavedView,
  setDefaultView,
  updateSavedView,
} from "@/actions/discovery/saved-views";
import { Can } from "@/components/common/can";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { serializeListQuery } from "@/lib/services/discovery/filter-params";
import { cn } from "@/lib/utils";
import type {
  SavedViewDto,
  SubscriptionListFilter,
  SubscriptionListSort,
} from "@/types/discovery";
import {
  Bookmark,
  BookmarkPlus,
  MoreHorizontal,
  Star,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

interface SavedViewsBarProps {
  views: SavedViewDto[];
  filter: SubscriptionListFilter;
  sort: SubscriptionListSort;
  onApply: (view: SavedViewDto) => void;
  entity?: string;
}

function viewKey(
  filter: SubscriptionListFilter,
  sort: SubscriptionListSort | null
) {
  return serializeListQuery({ filter, sort: sort ?? undefined }).toString();
}

export function SavedViewsBar({
  views,
  filter,
  sort,
  onApply,
  entity = "subscriptions",
}: SavedViewsBarProps) {
  const t = useTranslations("discovery.savedViews");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);

  const currentKey = useMemo(() => viewKey(filter, sort), [filter, sort]);
  const activeId = useMemo(
    () => views.find((v) => viewKey(v.filters, v.sort) === currentKey)?.id,
    [views, currentKey]
  );

  const run = (
    task: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string
  ) => {
    startTransition(async () => {
      const result = await task();
      if (result.success) {
        toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(result.error ?? t("error"));
      }
    });
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    run(
      () =>
        createSavedView({
          entity,
          name: trimmed,
          filters: filter,
          sort,
          isShared,
        }),
      t("saved", { name: trimmed })
    );
    setDialogOpen(false);
    setName("");
    setIsShared(false);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-testid="saved-views-bar"
    >
      <Bookmark className="text-muted-foreground mr-0.5 h-3.5 w-3.5" />
      {views.length === 0 && (
        <span className="text-muted-foreground text-xs">{t("empty")}</span>
      )}
      {views.map((view) => {
        const isActive = view.id === activeId;
        return (
          <div
            key={view.id}
            className={cn(
              "group inline-flex h-7 items-center rounded-full border pr-1 pl-2.5 text-xs transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            )}
          >
            <button
              type="button"
              onClick={() => onApply(view)}
              className="inline-flex items-center gap-1"
              aria-pressed={isActive}
            >
              {view.isDefault && <Star className="h-3 w-3 fill-current" />}
              {view.isShared && <Users className="h-3 w-3 opacity-70" />}
              <span className="max-w-40 truncate">{view.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("menu", { name: view.name })}
                  className={cn(
                    "ml-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100",
                    isActive
                      ? "hover:bg-primary-foreground/20"
                      : "hover:bg-muted-foreground/15"
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  disabled={isPending}
                  onSelect={() =>
                    run(
                      () =>
                        setDefaultView(view.isDefault ? null : view.id, entity),
                      view.isDefault
                        ? t("defaultCleared")
                        : t("defaultSet", { name: view.name })
                    )
                  }
                >
                  <Star className="mr-2 h-3.5 w-3.5" />
                  {view.isDefault ? t("clearDefault") : t("setDefault")}
                </DropdownMenuItem>
                {(view.isOwner || view.isShared) && (
                  <>
                    <DropdownMenuItem
                      disabled={isPending}
                      onSelect={() =>
                        run(
                          () =>
                            updateSavedView({
                              id: view.id,
                              filters: filter,
                              sort,
                            }),
                          t("updated", { name: view.name })
                        )
                      }
                    >
                      <BookmarkPlus className="mr-2 h-3.5 w-3.5" />
                      {t("updateWithCurrent")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={isPending}
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        run(
                          () => deleteSavedView(view.id),
                          t("deleted", { name: view.name })
                        )
                      }
                    >
                      {t("delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}

      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={() => setDialogOpen(true)}
        disabled={isPending}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        {t("save")}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="saved-view-name">{t("name")}</Label>
              <Input
                id="saved-view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                maxLength={60}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <Can permission="subscriptions:read_all">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="saved-view-shared">{t("shared")}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t("sharedHint")}
                  </p>
                </div>
                <Switch
                  id="saved-view-shared"
                  checked={isShared}
                  onCheckedChange={setIsShared}
                />
              </div>
            </Can>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || isPending}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
