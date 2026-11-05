"use client";

import type { CostCenterOptions } from "@/actions/platform/masters/cost-centers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BillingCycleRow,
  CostCenterRow,
  CurrencyRow,
  MasterOption,
  PaymentMethodRow,
  TaxRateRow,
} from "@/types/platform";
import {
  Banknote,
  Building,
  CalendarClock,
  Coins,
  Receipt,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { BillingCyclesPanel } from "./billing-cycles-panel";
import { CostCentersPanel } from "./cost-centers-panel";
import { CurrenciesPanel } from "./currencies-panel";
import { PaymentMethodsPanel } from "./payment-methods-panel";
import { TaxRatesPanel } from "./tax-rates-panel";

export interface MastersData {
  currencies: CurrencyRow[];
  taxRates: TaxRateRow[];
  costCenters: CostCenterRow[];
  costCenterOptions: CostCenterOptions;
  paymentMethods: PaymentMethodRow[];
  corporateCards: MasterOption[];
  billingCycles: BillingCycleRow[];
}

const TABS = [
  "currencies",
  "tax-rates",
  "cost-centers",
  "payment-methods",
  "billing-cycles",
] as const;
type TabKey = (typeof TABS)[number];
const DEFAULT_TAB: TabKey = "currencies";

export function MastersTabs({
  data,
  canManage,
}: {
  data: MastersData;
  canManage: boolean;
}) {
  const t = useTranslations("platform.masters");
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const active: TabKey = TABS.includes(requested as TabKey)
    ? (requested as TabKey)
    : DEFAULT_TAB;

  return (
    <Tabs
      value={active}
      onValueChange={(v) => router.replace(`/settings/masters?tab=${v}`)}
      className="w-full"
    >
      <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-2 overflow-visible border-b-0 bg-transparent p-0">
        {[
          { key: "currencies", icon: Coins },
          { key: "tax-rates", icon: Receipt },
          { key: "cost-centers", icon: Building },
          { key: "payment-methods", icon: Banknote },
          { key: "billing-cycles", icon: CalendarClock },
        ].map(({ key, icon: Icon }) => (
          <TabsTrigger
            key={key}
            value={key}
            className="text-foreground hover:bg-primary/10 hover:text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:text-primary-foreground h-[38px] gap-2 rounded-md px-4 after:hidden data-[state=active]:shadow-xs"
          >
            <Icon className="size-4" />
            {t(`tabs.${key}`)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="currencies">
        <CurrenciesPanel rows={data.currencies} canManage={canManage} />
      </TabsContent>
      <TabsContent value="tax-rates">
        <TaxRatesPanel rows={data.taxRates} canManage={canManage} />
      </TabsContent>
      <TabsContent value="cost-centers">
        <CostCentersPanel
          rows={data.costCenters}
          options={data.costCenterOptions}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="payment-methods">
        <PaymentMethodsPanel
          rows={data.paymentMethods}
          cards={data.corporateCards}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="billing-cycles">
        <BillingCyclesPanel rows={data.billingCycles} canManage={canManage} />
      </TabsContent>
    </Tabs>
  );
}
