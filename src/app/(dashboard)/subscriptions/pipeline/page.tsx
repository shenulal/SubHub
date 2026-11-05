// src/app/(dashboard)/subscriptions/pipeline/page.tsx
/**
 * Renewal pipeline (9.5). Lanes are computed server-side in base currency; the
 * board/list choice is kept in the URL (`?view=list`) so it is shareable.
 */
import { getRenewalPipeline } from "@/actions/discovery/pipeline";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RenewalPipelinePageClient } from "./page.client";

export const metadata: Metadata = { title: "Renewal pipeline" };

interface PageProps {
  searchParams: Promise<{ view?: string; scope?: string }>;
}

export default async function RenewalPipelinePage({ searchParams }: PageProps) {
  await requirePermissionOrRedirect("subscriptions:read");
  const params = await searchParams;
  const t = await getTranslations("discovery.pipeline");
  const result = await getRenewalPipeline({ scope: params.scope });

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl font-medium">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-[0.9375rem]">
          {t("description")}
        </p>
      </div>
      {result.success && result.data ? (
        <RenewalPipelinePageClient
          data={result.data}
          initialView={params.view === "list" ? "list" : "board"}
        />
      ) : (
        <div className="tonal-error rounded-md px-4 py-3 text-[0.9375rem]">
          {result.error ?? t("loadFailed")}
        </div>
      )}
    </div>
  );
}
