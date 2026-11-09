// src/app/(dashboard)/settings/masters/page.tsx
import { listAppsForMasters } from "@/actions/apps-master-list";
import { listBillingCycles } from "@/actions/platform/masters/billing-cycles";
import {
  listCostCenterOptions,
  listCostCenters,
} from "@/actions/platform/masters/cost-centers";
import { listCountries } from "@/actions/platform/masters/countries";
import { listCurrencies } from "@/actions/platform/masters/currencies";
import {
  listCorporateCardOptions,
  listPaymentMethods,
} from "@/actions/platform/masters/payment-methods";
import { listRejectionReasons } from "@/actions/platform/masters/rejection-reasons";
import { listTaxRates } from "@/actions/platform/masters/tax-rates";
import {
  listCatalogEntries,
  type CatalogPage,
} from "@/actions/taxonomy/catalog-admin";
import { getCategoryTree } from "@/actions/taxonomy/categories";
import { getCustomFieldDefinitions } from "@/actions/taxonomy/custom-fields";
import { listTags } from "@/actions/taxonomy/tags";
import {
  MastersTabs,
  type MastersAccess,
  type MastersData,
} from "@/components/platform/masters/masters-tabs";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { isForbiddenError, requirePermission } from "@/lib/rbac/service";
import { getSettings } from "@/lib/settings/service";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Master data" };

const READ_ANY: PermissionKey[] = [
  "masters:read",
  "catalog:read",
  "categories:read",
  "tags:read",
  "custom_fields:read",
  "apps:read",
];

const EMPTY_CATALOG: CatalogPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 1,
  categories: [],
};

async function requireAnyRead() {
  try {
    return await requirePermission(READ_ANY, { mode: "any" });
  } catch (error) {
    if (isForbiddenError(error)) redirect("/settings");
    throw error;
  }
}

function toAccess(set: Set<string>): MastersAccess {
  return {
    readMasters: set.has("masters:read"),
    manageMasters: set.has("masters:manage"),
    manageGlobal: set.has("masters:manage_global"),
    readCategories: set.has("categories:read"),
    manageCategories: set.has("categories:manage"),
    readTags: set.has("tags:read"),
    manageTags: set.has("tags:manage"),
    createTags: set.has("tags:create"),
    readCustomFields: set.has("custom_fields:read"),
    manageCustomFields: set.has("custom_fields:manage"),
    readCatalog: set.has("catalog:read"),
    manageCatalog: set.has("catalog:manage"),
    readApps: set.has("apps:read"),
    manageApps: set.has("apps:manage"),
  };
}

function when<T>(allowed: boolean, load: () => Promise<T>, fallback: T) {
  return allowed ? load() : Promise.resolve(fallback);
}

async function loadMasters(access: MastersAccess, organizationId: string) {
  const m = access.readMasters;
  return Promise.all([
    when(m, () => listCurrencies({ includeInactive: true }), null),
    when(m, () => listCountries({ includeInactive: true }), null),
    when(m, () => listTaxRates(), null),
    when(m, () => listCostCenters(), null),
    when(m, () => listCostCenterOptions(), null),
    when(m, () => listPaymentMethods(), null),
    when(m, () => listCorporateCardOptions(), null),
    when(m, () => listBillingCycles(), null),
    when(access.readCatalog, () => listCatalogEntries({}), null),
    when(m, () => listRejectionReasons(), null),
    when(Boolean(access.readApps), () => listAppsForMasters({}), null),
    getSettings(organizationId, [
      "subscriptions.maxCustomFields",
      "discovery.searchDebounceMs",
    ]),
  ]);
}

export default async function MastersPage() {
  const { organizationId, permissions } = await requireAnyRead();
  const access = toAccess(permissions);
  const [
    [
      currencies,
      countries,
      taxRates,
      costCenters,
      costCenterOptions,
      paymentMethods,
      corporateCards,
      billingCycles,
      catalog,
      rejectionReasons,
      apps,
      settings,
    ],
    categoryTree,
    tags,
    customFields,
  ] = await Promise.all([
    loadMasters(access, organizationId),
    when(
      access.readCategories,
      () => getCategoryTree({ includeArchived: true }),
      []
    ),
    when(access.readTags, () => listTags(), []),
    when(
      access.readCustomFields,
      () => getCustomFieldDefinitions({ includeArchived: true }),
      []
    ),
  ]);
  const data: MastersData = {
    currencies: currencies?.data ?? [],
    countries: countries?.data ?? [],
    taxRates: taxRates?.data ?? [],
    costCenters: costCenters?.data ?? [],
    costCenterOptions: costCenterOptions?.data ?? {
      owners: [],
      teams: [],
      currencies: [],
      baseCurrency: "",
    },
    paymentMethods: paymentMethods?.data ?? [],
    corporateCards: corporateCards?.data ?? [],
    billingCycles: billingCycles?.data ?? [],
    rejectionReasons: rejectionReasons?.data ?? [],
    categoryTree,
    tags,
    customFields,
    maxCustomFields: settings["subscriptions.maxCustomFields"],
    catalog: catalog?.data ?? EMPTY_CATALOG,
    apps: apps?.data ?? undefined,
    searchDebounceMs: settings["discovery.searchDebounceMs"],
  };
  return (
    <Suspense>
      <MastersTabs data={data} access={access} />
    </Suspense>
  );
}
