// src/components/subscriptions/subscription-detail-payments.tsx
"use client";

import type { LinkedPayment } from "@/actions/subscriptions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "./subscription-detail.utils";

interface SubscriptionDetailPaymentsProps {
  linkedPayments: LinkedPayment[];
  isLoading: boolean;
}

export function SubscriptionDetailPayments({
  linkedPayments,
  isLoading,
}: SubscriptionDetailPaymentsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="tonal-primary flex size-9 shrink-0 items-center justify-center rounded-md">
            <CreditCard className="size-5" />
          </span>
          연결된 결제 내역
          {linkedPayments.length > 0 && (
            <Badge variant="secondary">{linkedPayments.length}건</Badge>
          )}
        </CardTitle>
        <CardDescription>이 구독과 연결된 카드 결제 내역</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : linkedPayments.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            연결된 결제 내역이 없습니다
          </div>
        ) : (
          <div className="space-y-3">
            {linkedPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-muted/60 flex min-w-0 items-center justify-between gap-4 rounded-md p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-foreground truncate font-medium">
                    {payment.merchantName}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {formatDate(payment.transactionDate)}
                    {payment.cardLast4 && ` · 카드 ****${payment.cardLast4}`}
                  </div>
                </div>
                <div className="shrink-0 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(payment.amount, payment.currency)}
                </div>
              </div>
            ))}
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                총 결제 금액
              </span>
              <span className="text-foreground font-medium tabular-nums">
                {formatCurrency(
                  linkedPayments.reduce((sum, p) => sum + p.amount, 0),
                  linkedPayments[0].currency
                )}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
