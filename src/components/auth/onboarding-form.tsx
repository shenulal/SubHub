// src/components/auth/onboarding-form.tsx
"use client";

import { createOrganization } from "@/actions/organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/types";
import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useMemo, useState } from "react";

export interface OnboardingFormProps {
  /** Single-tenant first-run setup: this organisation is the installation's only one. */
  firstRun?: boolean;
}

/**
 * Organization creation form (onboarding). Shown only when the deployment mode
 * allows a new organisation; the server action re-checks the rule.
 */
export function OnboardingForm({ firstRun = false }: OnboardingFormProps) {
  const t = useTranslations();
  const [state, formAction, isPending] = useActionState(
    async (_prevState: ActionState | null, formData: FormData) =>
      (await createOrganization(formData)) ?? null,
    null
  );

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const interests = useMemo(
    () => [
      { id: "security", label: t("auth.onboarding.interests.security") },
      { id: "renewal", label: t("auth.onboarding.interests.renewal") },
      { id: "cost", label: t("auth.onboarding.interests.cost") },
      { id: "shadow", label: t("auth.onboarding.interests.shadow") },
      { id: "inventory", label: t("auth.onboarding.interests.inventory") },
      { id: "automation", label: t("auth.onboarding.interests.automation") },
    ],
    [t]
  );

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  return (
    <div data-testid="onboarding-page" className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-primary text-[0.8125rem] font-medium">
            {t("auth.onboarding.step")}
          </p>
          <Badge variant="primary" className="flex shrink-0 items-center gap-1">
            <Sparkles className="size-3.5" />
            {t("auth.onboarding.interestBadge", {
              count: selectedInterests.length,
            })}
          </Badge>
        </div>
        <h1 className="text-foreground text-2xl font-medium">
          {t("auth.onboarding.title")}
        </h1>
        <p className="text-muted-foreground text-[0.9375rem]">
          {t("auth.onboarding.description")}
        </p>
      </div>

      {firstRun && (
        <div
          data-testid="onboarding-first-run"
          className="tonal-info flex items-start gap-3 rounded-md p-3"
        >
          <Info className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium">
              {t("platform.onboarding.firstRunTitle")}
            </p>
            <p className="text-[0.8125rem]">
              {t("platform.onboarding.firstRunBody")}
            </p>
          </div>
        </div>
      )}

      {state && !state.success && state.error && (
        <p
          role="alert"
          className="tonal-error rounded-md px-3 py-2 text-[0.8125rem]"
        >
          {state.error}
        </p>
      )}

      <section className="flex flex-col gap-5 border-t pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-lg font-medium">
            {t("auth.onboarding.org.title")}
          </h2>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("auth.onboarding.org.description")}
          </p>
        </div>
        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t("auth.onboarding.org.name")}</Label>
            <Input
              id="name"
              name="name"
              placeholder={t("auth.onboarding.org.placeholder")}
              required
              minLength={2}
              maxLength={50}
              disabled={isPending}
            />
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("auth.onboarding.org.helper")}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">
              {t("auth.onboarding.org.domain", {
                defaultValue: "Company Domain *",
              })}
            </Label>
            <Input
              id="domain"
              name="domain"
              placeholder={t("auth.onboarding.org.domainPlaceholder", {
                defaultValue: "company.com",
              })}
              required
              disabled={isPending}
            />
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("auth.onboarding.org.domainHelper", {
                defaultValue:
                  "Enter your company email domain. This is used for Extension user verification.",
              })}
            </p>
          </div>

          <div className="flex flex-col gap-3 border-t pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-foreground text-[0.9375rem] font-medium">
                  {t("auth.onboarding.goals.title")}
                </p>
                <p className="text-muted-foreground text-[0.8125rem]">
                  {t("auth.onboarding.goals.description")}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {t("auth.onboarding.goals.selected", {
                  count: selectedInterests.length,
                })}
              </Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {interests.map((item) => {
                const active = selectedInterests.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleInterest(item.id)}
                    className={cn(
                      "hover:border-primary/60 focus-visible:ring-primary/20 flex h-10 min-w-0 items-center justify-between gap-2 rounded-md border px-3 text-left transition-colors outline-none focus-visible:ring-[3px]",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input text-foreground"
                    )}
                  >
                    <span
                      className="truncate text-[0.8125rem] font-medium"
                      title={item.label}
                    >
                      {item.label}
                    </span>
                    {active && <CheckCircle2 className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? t("auth.onboarding.actions.creating")
              : t("auth.onboarding.actions.start")}
          </Button>
        </form>
      </section>
    </div>
  );
}
