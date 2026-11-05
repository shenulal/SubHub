// src/components/taxonomy/cancellation-guide.tsx
"use client";

import {
  CalendarClock,
  CreditCard,
  ExternalLink,
  Pencil,
  ScrollText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";

// Relative import on purpose: the vitest alias maps `@/hooks` to the ui-registry,
// which has no `use-permissions`, so `@/components/common/can` cannot be rendered in tests.
import { usePermissions } from "../../hooks/use-permissions";

import { CancellationGuideEditDialog } from "./cancellation-guide-edit-dialog";

export interface CancellationGuideProps {
  subscriptionId?: string;
  /** App id enables the org-level override editor. */
  appId?: string;
  catalog: CatalogItemDto | null;
  appOverride: AppCancellationOverride | null;
  /** Subscription-level notice period; falls back to the catalog value. */
  noticePeriodDays?: number | null;
  onUpdated?: () => void;
  className?: string;
}

function ExternalButton({
  href,
  icon: Icon,
  children,
  variant = "default",
}: {
  href: string;
  icon: typeof ExternalLink;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <Button asChild variant={variant} size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Icon className="size-4" />
        {children}
        <ExternalLink className="size-3 opacity-60" />
      </a>
    </Button>
  );
}

/** Step-by-step cancellation guide with deep links; edit affordances are gated by RBAC (`catalog:manage`, `subscriptions:update`). */
export function CancellationGuide({
  appId,
  catalog,
  appOverride,
  noticePeriodDays,
  onUpdated,
  className,
}: CancellationGuideProps) {
  const t = useTranslations("taxonomy.cancellation");
  const { can, isLoading: isPermissionsLoading } = usePermissions();
  const [editing, setEditing] = useState<"catalog" | "override" | null>(null);
  const canEditOverride = !isPermissionsLoading && can("subscriptions:update");
  const canEditCatalog = !isPermissionsLoading && can("catalog:manage");

  const cancellationUrl =
    appOverride?.cancellationUrl || catalog?.cancellationUrl || null;
  const notice = noticePeriodDays ?? catalog?.noticePeriodDays ?? null;
  const steps = catalog?.cancellationSteps ?? [];
  const hasGuide =
    steps.length > 0 ||
    Boolean(cancellationUrl) ||
    Boolean(appOverride?.cancellationNotes);
  const isOverridden = Boolean(
    appOverride?.cancellationUrl || appOverride?.cancellationNotes
  );

  return (
    <section
      aria-labelledby="cancellation-guide-heading"
      className={cn(
        "bg-card text-card-foreground relative overflow-hidden rounded-lg border",
        className
      )}
    >
      <div className="from-destructive/8 pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent" />
      <header className="relative flex items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-center gap-2">
          <ScrollText className="text-destructive size-4" />
          <h3
            id="cancellation-guide-heading"
            className="text-foreground text-lg font-medium"
          >
            {t("title")}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {appId && canEditOverride && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing("override")}
            >
              <Pencil className="size-3.5" />
              {t("editOverride")}
            </Button>
          )}
          {catalog && canEditCatalog && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing("catalog")}
            >
              <Pencil className="size-3.5" />
              {t("editGuide")}
            </Button>
          )}
        </div>
      </header>

      <div className="relative space-y-4 px-5 pb-5">
        {!hasGuide && (
          <p className="text-muted-foreground text-sm">{t("noGuide")}</p>
        )}

        {steps.length > 0 && (
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="bg-muted text-muted-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="leading-5">{step}</span>
              </li>
            ))}
          </ol>
        )}

        {appOverride?.cancellationNotes && (
          <div className="border-primary/40 bg-muted/40 rounded-md border-l-2 p-3 text-sm">
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("orgNotes")}
            </p>
            <p className="whitespace-pre-line">
              {appOverride.cancellationNotes}
            </p>
          </div>
        )}

        {notice !== null && notice > 0 && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CalendarClock className="size-4" />
            {t("noticePeriod", { days: notice })}
          </p>
        )}

        {(cancellationUrl || catalog?.billingPortalUrl) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {cancellationUrl && (
              <ExternalButton href={cancellationUrl} icon={ScrollText}>
                {t("openCancellation")}
              </ExternalButton>
            )}
            {catalog?.billingPortalUrl && (
              <ExternalButton
                href={catalog.billingPortalUrl}
                icon={CreditCard}
                variant="outline"
              >
                {t("billingPortal")}
              </ExternalButton>
            )}
          </div>
        )}

        {hasGuide && (
          <p className="text-muted-foreground text-xs">
            {isOverridden ? t("sourceOverride") : t("sourceCatalog")}
          </p>
        )}
      </div>

      {editing === "catalog" && catalog && (
        <CancellationGuideEditDialog
          mode="catalog"
          catalog={catalog}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={onUpdated}
        />
      )}
      {editing === "override" && appId && (
        <CancellationGuideEditDialog
          mode="override"
          appId={appId}
          appOverride={appOverride}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={onUpdated}
        />
      )}
    </section>
  );
}
