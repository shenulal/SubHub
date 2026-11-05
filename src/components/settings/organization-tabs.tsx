// src/components/settings/organization-tabs.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FEATURES } from "@/config/features";
import { Building2, Globe, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { DomainManagement } from "./domain-management";
import { OrganizationForm } from "./organization-form";
import { TeamManagement } from "./team-management";

/** Materio pill tab (account-settings style). */
const PILL_TAB =
  "text-foreground hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:text-primary-foreground h-[38px] min-w-0 gap-2 rounded-md px-4 after:hidden data-[state=active]:shadow-xs";

interface OrganizationTabsProps {
  organization: {
    name: string;
    domain: string | null;
    logoUrl: string | null;
    settings: Record<string, unknown> | null;
  };
}

export function OrganizationTabs({ organization }: OrganizationTabsProps) {
  const t = useTranslations();
  // settings에서 teams 배열 추출
  const teams = (organization.settings?.teams as string[]) || [];
  // settings에서 domains 배열 추출
  const additionalDomains = (organization.settings?.domains as string[]) || [];

  // 활성 탭 수 계산 (정보 탭은 항상 표시)
  const tabCount =
    1 +
    (FEATURES.ORGANIZATION_TEAMS ? 1 : 0) +
    (FEATURES.ORGANIZATION_DOMAINS ? 1 : 0);
  const gridColsMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList
        className={`grid h-auto w-full max-w-2xl gap-2 overflow-visible border-b-0 ${gridColsMap[tabCount] || "grid-cols-1"}`}
      >
        <TabsTrigger value="info" className={PILL_TAB}>
          <Building2 className="size-4" />
          {t("settings.organization.tabs.info")}
        </TabsTrigger>
        {FEATURES.ORGANIZATION_TEAMS && (
          <TabsTrigger value="teams" className={PILL_TAB}>
            <Users className="size-4" />
            {t("settings.organization.tabs.teams")}
          </TabsTrigger>
        )}
        {FEATURES.ORGANIZATION_DOMAINS && (
          <TabsTrigger value="domains" className={PILL_TAB}>
            <Globe className="size-4" />
            {t("settings.organization.tabs.domains")}
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="info" className="mt-6">
        <OrganizationForm
          defaultValues={{
            name: organization.name,
            domain: organization.domain || "",
            logoUrl: organization.logoUrl || "",
            address: (organization.settings?.address as string) || "",
          }}
        />
      </TabsContent>
      {FEATURES.ORGANIZATION_TEAMS && (
        <TabsContent value="teams" className="mt-6">
          <TeamManagement initialTeams={teams} />
        </TabsContent>
      )}
      {FEATURES.ORGANIZATION_DOMAINS && (
        <TabsContent value="domains" className="mt-6">
          <DomainManagement
            initialDomains={additionalDomains}
            primaryDomain={organization.domain || ""}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
