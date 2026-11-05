// src/app/(dashboard)/payments/page.tsx
import { PageHeader } from "@/components/common/page-header";
import { PaymentTabs } from "@/components/payments/payment-tabs";
import { requireRole } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("payments.page");
  return {
    title: `${t("title")}`,
    description: t("description"),
  };
}

export default async function PaymentsPage() {
  const t = await getTranslations("payments.page");
  const { organizationId } = await requireRole(["ADMIN", "APPROVER", "MEMBER"]);

  // Fetch the app list for matching (includes teams - used by the subscription dialog)
  const appsRaw = await prisma.app.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      teams: {
        select: {
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  const apps = appsRaw.map((app) => ({ id: app.id, name: app.name }));
  const appsWithTeams = appsRaw.map((app) => ({
    id: app.id,
    name: app.name,
    teams: app.teams.map((t) => ({ id: t.team.id, name: t.team.name })),
  }));

  // Fetch subscriptions (for linking payments)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      app: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      app: {
        name: "asc",
      },
    },
  });

  const subscriptionList = subscriptions.map((sub) => ({
    id: sub.id,
    appName: sub.app.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <Suspense>
        <PaymentTabs
          apps={apps}
          subscriptions={subscriptionList}
          appsWithTeams={appsWithTeams}
        />
      </Suspense>
    </div>
  );
}
