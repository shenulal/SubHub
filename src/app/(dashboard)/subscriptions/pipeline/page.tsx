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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {result.success && result.data ? (
        <RenewalPipelinePageClient
          data={result.data}
          initialView={params.view === "list" ? "list" : "board"}
        />
      ) : (
        <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
          {result.error ?? t("loadFailed")}
        </div>
      )}
    </div>
  );
}
