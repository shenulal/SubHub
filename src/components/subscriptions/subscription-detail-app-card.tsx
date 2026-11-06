// src/components/subscriptions/subscription-detail-app-card.tsx
"use client";

import { AppLogo } from "@/components/apps/app-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BillingCycle, SubscriptionStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import {
  getBillingCycleLabels,
  getStatusLabels,
  statusToneClasses,
} from "./subscription-detail.constants";
import { formatCurrency } from "./subscription-detail.utils";

interface SubscriptionDetailAppCardProps {
  appName: string;
  appLogoUrl: string | null;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
}

export function SubscriptionDetailAppCard({
  appName,
  appLogoUrl,
  status,
  billingCycle,
  amount,
  currency,
}: SubscriptionDetailAppCardProps) {
  const t = useTranslations();
  const statusLabels = getStatusLabels(t);
  const billingCycleLabels = getBillingCycleLabels(t);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          <AppLogo
            src={appLogoUrl}
            name={appName}
            className="size-24 rounded-md p-1"
            fallbackClassName="text-3xl"
          />
          <h2
            className="text-foreground mt-4 max-w-full truncate text-xl font-medium"
            title={appName}
          >
            {appName}
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className={statusToneClasses[status]}>
              {statusLabels[status]}
            </Badge>
            <Badge variant="secondary">
              {billingCycleLabels[billingCycle]}
            </Badge>
          </div>
          <div className="text-foreground mt-4 max-w-full truncate text-2xl font-medium tabular-nums">
            {formatCurrency(amount, currency)}
            <span className="text-muted-foreground text-sm font-normal">
              /{billingCycleLabels[billingCycle]}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
