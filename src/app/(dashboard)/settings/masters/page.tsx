// src/app/(dashboard)/settings/masters/page.tsx
import { listBillingCycles } from "@/actions/platform/masters/billing-cycles";
import {
  listCostCenterOptions,
  listCostCenters,
} from "@/actions/platform/masters/cost-centers";
import { listCurrencies } from "@/actions/platform/masters/currencies";
import {
  listCorporateCardOptions,
  listPaymentMethods,
} from "@/actions/platform/masters/payment-methods";
import { listTaxRates } from "@/actions/platform/masters/tax-rates";
import {
  MastersTabs,
  type MastersData,
} from "@/components/platform/masters/masters-tabs";
import { can, requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Master data" };

export default async function MastersPage() {
  await requirePermissionOrRedirect("masters:read", "/settings");
  const [
    currencies,
    taxRates,
    costCenters,
    costCenterOptions,
    paymentMethods,
    corporateCards,
    billingCycles,
    canManage,
  ] = await Promise.all([
    listCurrencies(),
    listTaxRates(),
    listCostCenters(),
    listCostCenterOptions(),
    listPaymentMethods(),
    listCorporateCardOptions(),
    listBillingCycles(),
    can("masters:manage"),
  ]);
  const data: MastersData = {
    currencies: currencies.data ?? [],
    taxRates: taxRates.data ?? [],
    costCenters: costCenters.data ?? [],
    costCenterOptions: costCenterOptions.data ?? {
      owners: [],
      teams: [],
      currencies: [],
      baseCurrency: "",
    },
    paymentMethods: paymentMethods.data ?? [],
    corporateCards: corporateCards.data ?? [],
    billingCycles: billingCycles.data ?? [],
  };
  return (
    <Suspense>
      <MastersTabs data={data} canManage={canManage} />
    </Suspense>
  );
}
