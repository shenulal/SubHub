// src/components/subscriptions/subscription-suggestions.tsx
"use client";

import {
  createSubscriptionFromCardSuggestion,
  createSubscriptionFromPaymentSuggestion,
  suggestFromCardTransactions,
  suggestSubscriptionsFromPayments,
  type CardTransactionSuggestion,
  type PaymentRecordSuggestion,
} from "@/actions/subscriptions/subscription-suggestions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBaseCurrency } from "@/hooks/use-base-currency";
import { cn } from "@/lib/utils";
import { BillingCycle } from "@prisma/client";
import {
  AlertTriangle,
  Building,
  CalendarDays,
  Check,
  CreditCard,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { SuggestionUserAssignment } from "./suggestion-user-assignment";

// Unified Suggestion type (tracks the source)
type UnifiedSuggestion = CardTransactionSuggestion | PaymentRecordSuggestion;

export function SubscriptionSuggestions() {
  const { baseCurrency } = useBaseCurrency();
  const t = useTranslations("subscriptionSuggestions");
  const [suggestions, setSuggestions] = useState<UnifiedSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
    MONTHLY: t("billingCycle.MONTHLY"),
    QUARTERLY: t("billingCycle.QUARTERLY"),
    YEARLY: t("billingCycle.YEARLY"),
    ONE_TIME: t("billingCycle.ONE_TIME"),
  };
  // Track selected user IDs per app
  const [selectedUsersByApp, setSelectedUsersByApp] = useState<
    Record<string, string[]>
  >({});
  // SMP-134: Seat checkbox state (appId -> checked)
  const [seatCheckedByApp, setSeatCheckedByApp] = useState<
    Record<string, boolean>
  >({});
  // SMP-134: Total seats (appId -> totalSeats)
  const [totalSeatsByApp, setTotalSeatsByApp] = useState<
    Record<string, number | undefined>
  >({});

  const loadSuggestions = async () => {
    setIsLoading(true);

    // Load suggestions from both corporate card transactions and CSV payment records
    const [cardResult, paymentResult] = await Promise.all([
      suggestFromCardTransactions(),
      suggestSubscriptionsFromPayments(),
    ]);

    const allSuggestions: UnifiedSuggestion[] = [];

    if (cardResult.success && cardResult.data) {
      allSuggestions.push(...cardResult.data);
    }

    if (paymentResult.success && paymentResult.data) {
      // Exclude apps already in the card suggestions (avoid duplicates)
      const cardAppIds = new Set(cardResult.data?.map((s) => s.appId) ?? []);
      const uniquePaymentSuggestions = paymentResult.data.filter(
        (s) => !cardAppIds.has(s.appId)
      );
      allSuggestions.push(...uniquePaymentSuggestions);
    }

    setSuggestions(allSuggestions);

    // SMP-134: Initialise seat checkboxes (billingType === PER_SEAT -> checked)
    const initialSeatChecked: Record<string, boolean> = {};
    const initialTotalSeats: Record<string, number | undefined> = {};
    for (const s of allSuggestions) {
      initialSeatChecked[s.appId] = s.billingType === "PER_SEAT";
      initialTotalSeats[s.appId] = undefined;
    }
    setSeatCheckedByApp(initialSeatChecked);
    setTotalSeatsByApp(initialTotalSeats);

    // SMP-134: Prefill selection for suggestions that have an assignedUserId
    const initialSelectedUsers: Record<string, string[]> = {};
    for (const s of allSuggestions) {
      if (s.assignedUserId) {
        initialSelectedUsers[s.appId] = [s.assignedUserId];
      }
    }
    setSelectedUsersByApp(initialSelectedUsers);
    setIsLoading(false);
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleCreate = (suggestion: UnifiedSuggestion) => {
    const selectedUserIds = selectedUsersByApp[suggestion.appId] ?? [];
    const isSeatBased = seatCheckedByApp[suggestion.appId] ?? false;
    const totalSeats = totalSeatsByApp[suggestion.appId];

    // SMP-134: Seat-based subscription validation
    if (isSeatBased) {
      if (!totalSeats || totalSeats <= 0) {
        toast.error(t("seatRequiredError"));
        return;
      }
      if (selectedUserIds.length > totalSeats) {
        toast.error(
          t("seatExceededError", {
            assigned: selectedUserIds.length,
            total: totalSeats,
          })
        );
        return;
      }
    }

    setCreatingId(suggestion.appId);

    startTransition(async () => {
      // Call the create function that matches the source
      const result =
        suggestion.source === "card_transaction"
          ? await createSubscriptionFromCardSuggestion({
              suggestion,
              selectedUserIds,
              billingType: isSeatBased ? "PER_SEAT" : "FLAT_RATE",
              totalLicenses: isSeatBased ? (totalSeats ?? null) : null,
            })
          : await createSubscriptionFromPaymentSuggestion({
              suggestion,
              selectedUserIds,
              billingType: isSeatBased ? "PER_SEAT" : "FLAT_RATE",
              totalLicenses: isSeatBased ? (totalSeats ?? null) : null,
            });

      if (result.success) {
        toast.success(t("registered", { appName: suggestion.appName }));
        // Remove from the list
        setSuggestions((prev) =>
          prev.filter((s) => s.appId !== suggestion.appId)
        );
        // Clear the selection state
        setSelectedUsersByApp((prev) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [suggestion.appId]: _removed, ...rest } = prev;
          return rest;
        });
      } else {
        toast.error(result.message || t("registerFailed"));
      }
      setCreatingId(null);
    });
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || baseCurrency,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Confidence badge colours (per color-theme-guide.md)
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return (
        <Badge
          variant="secondary"
          className="bg-success-muted text-success-muted-foreground border-0"
        >
          {t("confidence.high")}
        </Badge>
      );
    } else if (confidence >= 0.6) {
      return (
        <Badge
          variant="secondary"
          className="bg-warning-muted text-warning-muted-foreground border-0"
        >
          {t("confidence.medium")}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {t("confidence.low")}
        </Badge>
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="text-warning h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null; // Hide when there are no suggestions
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-warning h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSuggestions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion) => {
            const selectedUserIds = selectedUsersByApp[suggestion.appId] ?? [];
            const isSeatChecked = seatCheckedByApp[suggestion.appId] ?? false;
            const totalSeats = totalSeatsByApp[suggestion.appId];
            // SMP-134: Seat validation - when checked, totalSeats is required and cannot be exceeded
            const isSeatInvalid =
              isSeatChecked &&
              (!totalSeats ||
                totalSeats <= 0 ||
                selectedUserIds.length > totalSeats);

            return (
              <div
                key={suggestion.appId}
                className="space-y-3 rounded-sm border p-4"
              >
                {/* Top: app info + register button */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={suggestion.appLogoUrl || undefined} />
                    <AvatarFallback>
                      {suggestion.appName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{suggestion.appName}</span>
                      {getConfidenceBadge(suggestion.confidence)}
                      {/* Source badge (per color-theme-guide.md) */}
                      <Badge
                        variant="secondary"
                        className="bg-secondary text-secondary-foreground border-0"
                      >
                        <CreditCard className="mr-1 h-3 w-3" />
                        {suggestion.source === "card_transaction"
                          ? t("source.card")
                          : t("source.csv")}
                      </Badge>
                      {/* Phase 2: user assignment badge (automatic) - success-muted */}
                      {suggestion.assignedUserId && (
                        <Badge
                          variant="secondary"
                          className="bg-success-muted text-success-muted-foreground border-0"
                        >
                          <User className="mr-1 h-3 w-3" />
                          {suggestion.assignedUserName}
                        </Badge>
                      )}
                      {/* Team badge - info-muted */}
                      {suggestion.teamName && (
                        <Badge
                          variant="secondary"
                          className="bg-info-muted text-info-muted-foreground border-0"
                        >
                          <Building className="mr-1 h-3 w-3" />
                          {suggestion.teamName}
                        </Badge>
                      )}
                      {/* Phase 3: unassigned warning - warning-muted */}
                      {!suggestion.teamId && !suggestion.assignedUserId && (
                        <Badge
                          variant="secondary"
                          className="bg-warning-muted text-warning-muted-foreground border-0"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {t("unassigned")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        {
                          BILLING_CYCLE_LABELS[suggestion.suggestedBillingCycle]
                        }{" "}
                        {t("payment")}
                      </span>
                      <span>
                        {formatAmount(
                          suggestion.suggestedAmount,
                          suggestion.currency
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {t("analyzed", { count: suggestion.paymentCount })}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDate(suggestion.firstPaymentDate)} ~{" "}
                      {formatDate(suggestion.lastPaymentDate)}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleCreate(suggestion)}
                    disabled={
                      (isPending && creatingId === suggestion.appId) ||
                      isSeatInvalid
                    }
                  >
                    {isPending && creatingId === suggestion.appId ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    {t("register")}
                  </Button>
                </div>

                {/* SMP-134: Seat-based checkbox + user assignment */}
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t pt-3">
                  {/* Left: checkbox + SMP-160 confidence badge */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`seat-${suggestion.appId}`}
                      checked={isSeatChecked}
                      onCheckedChange={(checked) =>
                        setSeatCheckedByApp((prev) => ({
                          ...prev,
                          [suggestion.appId]: !!checked,
                        }))
                      }
                      disabled={isPending && creatingId === suggestion.appId}
                    />
                    <Label
                      htmlFor={`seat-${suggestion.appId}`}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {t("seatBased")}
                    </Label>
                  </div>

                  {/* Right: seat details (only when checked) */}
                  {isSeatChecked ? (
                    <div className="flex items-center gap-3">
                      <Label className="shrink-0 text-sm">
                        {t("totalSeats")}
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={totalSeats ?? ""}
                        onChange={(e) =>
                          setTotalSeatsByApp((prev) => ({
                            ...prev,
                            [suggestion.appId]: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          }))
                        }
                        placeholder={t("totalSeatsPlaceholder")}
                        className={cn(
                          "max-w-[140px]",
                          isSeatInvalid && "border-error"
                        )}
                        disabled={isPending && creatingId === suggestion.appId}
                      />
                      <span
                        className={cn(
                          "shrink-0 text-xs",
                          totalSeats && selectedUserIds.length > totalSeats
                            ? "text-error font-medium"
                            : "text-muted-foreground"
                        )}
                      >
                        {t("seatStatus", {
                          assigned: selectedUserIds.length,
                          total: totalSeats ?? "–",
                        })}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* User assignment - only when the seat box is checked */}
                  {isSeatChecked && (
                    <>
                      <div className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Users className="h-4 w-4" />
                        <span className="whitespace-nowrap">
                          {t("userAssignment")}
                        </span>
                      </div>

                      <SuggestionUserAssignment
                        availableUsers={suggestion.availableUsers}
                        selectedUserIds={
                          selectedUsersByApp[suggestion.appId] ?? []
                        }
                        onSelectedUserIdsChange={(ids) =>
                          setSelectedUsersByApp((prev) => ({
                            ...prev,
                            [suggestion.appId]: ids,
                          }))
                        }
                        disabled={isPending && creatingId === suggestion.appId}
                        maxUsers={
                          isSeatChecked
                            ? totalSeatsByApp[suggestion.appId]
                            : undefined
                        }
                        onSeatLimitReached={() =>
                          toast.error(
                            t("seatExceededError", {
                              max: totalSeatsByApp[suggestion.appId],
                              current: (
                                selectedUsersByApp[suggestion.appId] ?? []
                              ).length,
                            })
                          )
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
