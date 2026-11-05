"use client";

/**
 * Master data hub (`/settings/masters?tab=…`). Every tab is shown only with its
 * read permission; create / edit / archive controls need the matching manage
 * permission (enforced again by the server actions).
 */
import type { CostCenterOptions } from "@/actions/platform/masters/cost-centers";
import type { CatalogPage } from "@/actions/taxonomy/catalog-admin";
import { CategoryTreeEditor } from "@/components/taxonomy/category-tree-editor";
import { CustomFieldManager } from "@/components/taxonomy/custom-field-manager";
import { TagManager } from "@/components/taxonomy/tag-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BillingCycleRow,
  CostCenterRow,
  CountryRow,
  CurrencyRow,
  MasterOption,
  PaymentMethodRow,
  TaxRateRow,
} from "@/types/platform";
import type {
  CategoryNode,
  CustomFieldDefinitionDto,
  TagDto,
} from "@/types/taxonomy";
import {
  Banknote,
  Building,
  CalendarClock,
  Coins,
  FolderTree,
  Globe2,
  ListPlus,
  type LucideIcon,
  Receipt,
  Store,
  Tags,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { BillingCyclesPanel } from "./billing-cycles-panel";
import { CostCentersPanel } from "./cost-centers-panel";
import { CountriesPanel } from "./countries-panel";
import { CurrenciesPanel } from "./currencies-panel";
import { PaymentMethodsPanel } from "./payment-methods-panel";
import { TaxRatesPanel } from "./tax-rates-panel";
import { VendorCatalogPanel } from "./vendor-catalog-panel";

export const MASTER_TABS = [
  "currencies",
  "countries",
  "tax-rates",
  "cost-centers",
  "payment-methods",
  "billing-cycles",
  "categories",
  "tags",
  "custom-fields",
  "vendor-catalog",
] as const;
export type MasterTabKey = (typeof MASTER_TABS)[number];

export interface MastersData {
  currencies: CurrencyRow[];
  countries: CountryRow[];
  taxRates: TaxRateRow[];
  costCenters: CostCenterRow[];
  costCenterOptions: CostCenterOptions;
  paymentMethods: PaymentMethodRow[];
  corporateCards: MasterOption[];
  billingCycles: BillingCycleRow[];
  categoryTree: CategoryNode[];
  tags: TagDto[];
  customFields: CustomFieldDefinitionDto[];
  maxCustomFields: number;
  catalog: CatalogPage;
  searchDebounceMs: number;
}

/** Resolved permission flags (server-computed). */
export interface MastersAccess {
  readMasters: boolean;
  readCatalog: boolean;
  manageMasters: boolean;
  manageGlobal: boolean;
  readCategories: boolean;
  manageCategories: boolean;
  readTags: boolean;
  manageTags: boolean;
  createTags: boolean;
  readCustomFields: boolean;
  manageCustomFields: boolean;
  manageCatalog: boolean;
}

const ICONS: Record<MasterTabKey, LucideIcon> = {
  currencies: Coins,
  countries: Globe2,
  "tax-rates": Receipt,
  "cost-centers": Building,
  "payment-methods": Banknote,
  "billing-cycles": CalendarClock,
  categories: FolderTree,
  tags: Tags,
  "custom-fields": ListPlus,
  "vendor-catalog": Store,
};

export function visibleMasterTabs(access: MastersAccess): MasterTabKey[] {
  return MASTER_TABS.filter((key) => {
    if (key === "categories") return access.readCategories;
    if (key === "tags") return access.readTags;
    if (key === "custom-fields") return access.readCustomFields;
    if (key === "vendor-catalog") return access.readCatalog;
    return access.readMasters;
  });
}

const PILL_TAB =
  "text-foreground hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:text-primary-foreground h-[38px] gap-2 rounded-md px-4 after:hidden data-[state=active]:shadow-xs";

function renderPanel(
  key: MasterTabKey,
  data: MastersData,
  access: MastersAccess
): ReactNode {
  const activeCurrencies = data.currencies
    .filter((c) => c.isActive)
    .map((c) => c.code);
  switch (key) {
    case "currencies":
      return (
        <CurrenciesPanel
          rows={data.currencies}
          canManage={access.manageMasters}
          canManageGlobal={access.manageGlobal}
        />
      );
    case "countries":
      return (
        <CountriesPanel
          rows={data.countries}
          currencyCodes={activeCurrencies}
          canManageGlobal={access.manageGlobal}
        />
      );
    case "tax-rates":
      return (
        <TaxRatesPanel rows={data.taxRates} canManage={access.manageMasters} />
      );
    case "cost-centers":
      return (
        <CostCentersPanel
          rows={data.costCenters}
          options={data.costCenterOptions}
          canManage={access.manageMasters}
        />
      );
    case "payment-methods":
      return (
        <PaymentMethodsPanel
          rows={data.paymentMethods}
          cards={data.corporateCards}
          canManage={access.manageMasters}
        />
      );
    case "billing-cycles":
      return (
        <BillingCyclesPanel
          rows={data.billingCycles}
          canManage={access.manageMasters}
        />
      );
    case "categories":
      return (
        <CategoryTreeEditor
          tree={data.categoryTree}
          canManage={access.manageCategories}
        />
      );
    case "tags":
      return (
        <TagManager
          tags={data.tags}
          canManage={access.manageTags}
          canCreate={access.createTags}
        />
      );
    case "custom-fields":
      return (
        <CustomFieldManager
          fields={data.customFields}
          maxFields={data.maxCustomFields}
          canManage={access.manageCustomFields}
        />
      );
    case "vendor-catalog":
      return (
        <VendorCatalogPanel
          initial={data.catalog}
          currencyCodes={activeCurrencies}
          countries={data.countries
            .filter((c) => c.isActive)
            .map((c) => ({ id: c.code, label: `${c.name} (${c.code})` }))}
          canManage={access.manageCatalog}
          canManageGlobal={access.manageGlobal}
          searchDebounceMs={data.searchDebounceMs}
        />
      );
  }
}

export function MastersTabs({
  data,
  access,
}: {
  data: MastersData;
  access: MastersAccess;
}) {
  const t = useTranslations("platform.masters");
  const router = useRouter();
  const params = useSearchParams();
  const tabs = visibleMasterTabs(access);
  const requested = params.get("tab") as MasterTabKey | null;
  const active: MasterTabKey | undefined =
    requested && tabs.includes(requested) ? requested : tabs[0];
  if (!active) return null;

  return (
    <Tabs
      value={active}
      onValueChange={(v) => router.replace(`/settings/masters?tab=${v}`)}
      className="w-full"
    >
      <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2 overflow-visible border-b-0 bg-transparent p-0">
        {tabs.map((key) => {
          const Icon = ICONS[key];
          return (
            <TabsTrigger key={key} value={key} className={PILL_TAB}>
              <Icon className="size-4" />
              {t(`tabs.${key}`)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {tabs.map((key) => (
        <TabsContent key={key} value={key}>
          {key === active ? renderPanel(key, data, access) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
