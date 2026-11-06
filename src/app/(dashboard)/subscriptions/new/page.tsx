// src/app/(dashboard)/subscriptions/new/page.tsx
import { getApps } from "@/actions/apps";
import { getSubscriptionFormOptions } from "@/actions/subscriptions/subscription-form-options";
import { getUsers } from "@/actions/users-read";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SubscriptionNewPageClient } from "./page.client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("subscriptions.newPage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function NewSubscriptionPage() {
  const { permissions } = await requirePermissionOrRedirect(
    "subscriptions:create",
    "/subscriptions"
  );
  // Seat assignment to other members (the action re-checks subscriptions:assign)
  const isAdmin = permissions.has("subscriptions:assign");

  const [{ items: apps }, { items: users }, options] = await Promise.all([
    getApps({ limit: 1000 }),
    getUsers({ limit: 1000, filter: { status: "ACTIVE" } }),
    getSubscriptionFormOptions(),
  ]);

  // App options: includes teams
  const appOptions = apps.map((app) => ({
    id: app.id,
    name: app.name,
    teams: app.teams ?? [],
    logoUrl: app.customLogoUrl || app.catalogLogoUrl || null,
  }));

  // User options: only for subscriptions:assign holders (includes teamId for per-team filtering)
  const userOptions = isAdmin
    ? users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        teamId: user.team?.id ?? null,
      }))
    : [];

  const t = await getTranslations("subscriptions.newPage");

  return (
    <SubscriptionNewPageClient
      apps={appOptions}
      users={userOptions}
      isAdmin={isAdmin}
      title={t("title")}
      options={options}
    />
  );
}
