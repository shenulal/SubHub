// src/app/(dashboard)/subscriptions/[id]/page.tsx
import { getSubscriptionCached } from "@/actions/subscriptions";
import { getCatalogItem } from "@/actions/taxonomy/catalog";
import { SubscriptionDetailClient } from "@/components/subscriptions/subscription-detail-client";
import { getCachedSession } from "@/lib/auth/require-auth";
import { getSettings } from "@/lib/settings/service";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface SubscriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SubscriptionDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const subscription = await getSubscriptionCached(id);

  if (!subscription) {
    return { title: "Subscription not found" };
  }

  return {
    title: `${subscription.appName}`,
    description: `${subscription.appName} subscription details`,
  };
}

export default async function SubscriptionDetailPage({
  params,
}: SubscriptionDetailPageProps) {
  const { id } = await params;
  const subscription = await getSubscriptionCached(id);
  if (!subscription) {
    notFound();
  }
  const session = await getCachedSession();
  const organizationId = session?.user?.organizationId;
  const role = session?.user?.role ?? null;

  const [settings, catalog] = await Promise.all([
    organizationId
      ? getSettings(organizationId, [
          "documents.maxAttachmentSizeMb",
          "documents.allowedMimeTypes",
          "subscriptions.noticePeriodAlertLeadDays",
        ])
      : null,
    subscription.app.catalogId
      ? getCatalogItem(subscription.app.catalogId)
      : Promise.resolve(null),
  ]);

  return (
    <SubscriptionDetailClient
      id={id}
      role={role as "ADMIN" | "APPROVER" | "MEMBER" | "VIEWER" | null}
      documentPolicy={
        settings
          ? {
              maxSizeMb: settings["documents.maxAttachmentSizeMb"],
              allowedMimeTypes: settings["documents.allowedMimeTypes"],
            }
          : undefined
      }
      noticeWindowDays={
        settings
          ? Math.max(...settings["subscriptions.noticePeriodAlertLeadDays"])
          : undefined
      }
      catalog={catalog}
      appOverride={{
        cancellationUrl: subscription.app.cancellationUrl,
        cancellationNotes: subscription.app.cancellationNotes,
      }}
    />
  );
}
