// src/app/super-admin/masters/page.tsx
/**
 * Platform masters — the platform-wide tables every organisation shares:
 * currencies, countries and the vendor catalog. In SaaS mode this console is the
 * only place they can be edited (tenant roles never hold `masters:manage_global`
 * or `catalog:manage`); in single-tenant mode the organisation ADMIN can also
 * edit them under Settings → Master data.
 */
import { listCountries } from "@/actions/platform/masters/countries";
import { listCurrencies } from "@/actions/platform/masters/currencies";
import { listCatalogEntries } from "@/actions/taxonomy/catalog-admin";
import { CountriesPanel } from "@/components/platform/masters/countries-panel";
import { CurrenciesPanel } from "@/components/platform/masters/currencies-panel";
import { VendorCatalogPanel } from "@/components/platform/masters/vendor-catalog-panel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireSuperAdmin } from "@/lib/auth/require-auth";
import { getSystemSetting } from "@/lib/settings/service";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform masters",
};

const EMPTY_CATALOG = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 1,
  categories: [],
};

export default async function PlatformMastersPage() {
  await requireSuperAdmin();
  const [currencies, countries, catalog, searchDebounceMs] = await Promise.all([
    listCurrencies({ includeInactive: true }),
    listCountries({ includeInactive: true }),
    listCatalogEntries({}),
    getSystemSetting("discovery.searchDebounceMs"),
  ]);
  const currencyRows = currencies.data ?? [];
  const countryRows = countries.data ?? [];
  const activeCurrencies = currencyRows
    .filter((c) => c.isActive)
    .map((c) => c.code);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-medium">
          Platform masters
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          Reference data shared by every organisation. Organisations choose
          which currencies they enable; the lists themselves are maintained
          here.
        </p>
      </div>
      <Tabs defaultValue="currencies" className="min-w-0">
        <TabsList>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="vendor-catalog">Vendor catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="currencies">
          <Card className="p-5 sm:p-6">
            <CurrenciesPanel
              rows={currencyRows}
              canManage={false}
              canManageGlobal
            />
          </Card>
        </TabsContent>
        <TabsContent value="countries">
          <Card className="p-5 sm:p-6">
            <CountriesPanel
              rows={countryRows}
              currencyCodes={activeCurrencies}
              canManageGlobal
            />
          </Card>
        </TabsContent>
        <TabsContent value="vendor-catalog">
          <Card className="p-5 sm:p-6">
            <VendorCatalogPanel
              initial={catalog.data ?? EMPTY_CATALOG}
              currencyCodes={activeCurrencies}
              countries={countryRows
                .filter((c) => c.isActive)
                .map((c) => ({ id: c.code, label: `${c.name} (${c.code})` }))}
              canManage
              canManageGlobal
              searchDebounceMs={searchDebounceMs}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
