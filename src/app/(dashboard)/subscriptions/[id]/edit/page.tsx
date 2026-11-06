// src/app/(dashboard)/subscriptions/[id]/edit/page.tsx
import { getApps } from "@/actions/apps";
import { getSubscriptionCached } from "@/actions/subscriptions";
import { getSubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { getUsers } from "@/actions/users-read";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SubscriptionEditPageClient } from "./page.client";

interface SubscriptionEditPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: SubscriptionEditPageProps): Promise<Metadata> {
  const { id } = await params;
  const subscription = await getSubscriptionCached(id);

  if (!subscription) {
    return { title: "Subscription not found" };
  }

  return {
    title: `Edit ${subscription.appName}`,
    description: `Edit the ${subscription.appName} subscription`,
  };
}

export default async function SubscriptionEditPage({
  params,
}: SubscriptionEditPageProps) {
  const { permissions } = await requirePermissionOrRedirect(
    "subscriptions:update",
    "/subscriptions"
  );
  const { id } = await params;
  // Seat assignment to other members (the action re-checks subscriptions:assign)
  const isAdmin = permissions.has("subscriptions:assign");

  const [subscription, { items: apps }, { items: users }, options] =
    await Promise.all([
      getSubscriptionCached(id),
      getApps({ limit: 1000 }),
      getUsers({ limit: 1000, filter: { status: "ACTIVE" } }),
      getSubscriptionFormOptions(),
    ]);

  if (!subscription) {
    notFound();
  }

  const appOptions = apps.map((app) => ({
    id: app.id,
    name: app.name,
    teams: app.teams ?? [],
    logoUrl: app.customLogoUrl || app.catalogLogoUrl || null,
  }));

  const userOptions = isAdmin
    ? users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        teamId: user.team?.id ?? null,
      }))
    : [];

  const t = await getTranslations("subscriptions");

  return (
    <SubscriptionEditPageClient
      apps={appOptions}
      users={userOptions}
      isAdmin={isAdmin}
      subscription={subscription}
      title={`${subscription.appName} ${t("actions.edit")}`}
      options={options}
    />
  );
}
