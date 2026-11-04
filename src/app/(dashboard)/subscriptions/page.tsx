// src/app/(dashboard)/subscriptions/page.tsx
/**
 * Subscription list (9.2 / 9.3 / 9.6). The URL search params are the single
 * source of truth for filter, sort and pagination; the server resolves them,
 * applies the user's default saved view on a bare visit and renders the page.
 */
import {
  getSubscriptionFilterOptions,
  getSubscriptionListPage,
} from "@/actions/discovery/list";
import { listSavedViews } from "@/actions/discovery/saved-views";
import { SubscriptionPageClient } from "@/components/subscriptions/subscription-page-client";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import {
  parseListQuery,
  serializeListQuery,
} from "@/lib/services/discovery/filter-params";
import { getSetting } from "@/lib/settings/service";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Subscriptions" };

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const { organizationId } =
    await requirePermissionOrRedirect("subscriptions:read");
  const params = await searchParams;
  const defaultPageSize = await getSetting(
    organizationId,
    "discovery.listPageSize"
  );

  const [views, options, canSelect] = await Promise.all([
    listSavedViews("subscriptions"),
    getSubscriptionFilterOptions(),
    can(["subscriptions:bulk", "subscriptions:export"], "any"),
  ]);
  const savedViews = views.success ? (views.data ?? []) : [];

  // Bare visit → jump to the user's default view (if any) so the URL stays shareable.
  if (Object.keys(params).length === 0) {
    const defaultView = savedViews.find((v) => v.isDefault);
    if (defaultView) {
      const qs = serializeListQuery(
        { filter: defaultView.filters, sort: defaultView.sort ?? undefined },
        defaultPageSize
      ).toString();
      if (qs) redirect(`/subscriptions?${qs}`);
    }
  }

  const query = parseListQuery(params, defaultPageSize);
  const page = await getSubscriptionListPage(query);
  const data = page.success ? page.data : undefined;

  return (
    <SubscriptionPageClient
      items={data?.items ?? []}
      total={data?.total ?? 0}
      totalPages={data?.totalPages ?? 1}
      monthlyTotalBase={data?.monthlyTotalBase ?? 0}
      baseCurrency={data?.baseCurrency ?? ""}
      hasStaleRates={data?.hasStaleRates ?? false}
      pageSizeOptions={data?.pageSizeOptions ?? [defaultPageSize]}
      defaultPageSize={defaultPageSize}
      options={
        options.success && options.data
          ? options.data
          : {
              categories: [],
              tags: [],
              owners: [],
              teams: [],
              costCenters: [],
              paymentMethods: [],
            }
      }
      savedViews={savedViews}
      canSelect={canSelect}
      error={page.success ? undefined : page.error}
    />
  );
}
