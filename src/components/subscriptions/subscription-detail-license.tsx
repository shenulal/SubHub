// src/components/subscriptions/subscription-detail-license.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BillingType } from "@prisma/client";

interface SubscriptionDetailLicenseProps {
  totalLicenses: number | null;
  usedLicenses: number | null;
  billingType: BillingType;
  perSeatPrice: number | null; // Reused in P2
  currency?: string; // Reused in P2
}

export function SubscriptionDetailLicense({
  totalLicenses,
  usedLicenses,
  billingType,
}: SubscriptionDetailLicenseProps) {
  if (!totalLicenses) return null;

  const used = usedLicenses ?? 0;
  const usagePercent = (used / totalLicenses) * 100;
  const isPerSeat = billingType === "PER_SEAT";
  const label = isPerSeat ? "Seat Usage" : "License Usage";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{label}</CardTitle>
          {isPerSeat && (
            <Badge
              variant="secondary"
              className="bg-info-muted text-info-muted-foreground border-0"
            >
              Per Seat
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">In use</span>
          <span className="font-medium">
            {used} / {totalLicenses}
            {isPerSeat ? " Seat" : ""}
          </span>
        </div>
        <Progress value={usagePercent} className="h-2" />
        <p className="text-muted-foreground text-xs">
          {totalLicenses - used}
          {isPerSeat ? " seats" : ""} remaining
        </p>
      </CardContent>
    </Card>
  );
}
