// src/components/settings/domain-management.tsx
"use client";

import { updateOrganizationDomains } from "@/actions/organization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface DomainManagementProps {
  initialDomains: string[];
  primaryDomain: string;
}

const DOMAIN_REGEX = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function DomainManagement({
  initialDomains,
  primaryDomain,
}: DomainManagementProps) {
  const t = useTranslations();
  const [domains, setDomains] = useState<string[]>(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAddDomain = () => {
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) {
      toast.error(t("settings.domains.toast.empty"));
      return;
    }
    if (!DOMAIN_REGEX.test(trimmed)) {
      toast.error(t("settings.domains.toast.invalid"));
      return;
    }
    if (trimmed === primaryDomain.toLowerCase()) {
      toast.error(t("settings.domains.toast.samePrimary"));
      return;
    }
    if (domains.includes(trimmed)) {
      toast.error(t("settings.domains.toast.duplicate"));
      return;
    }

    const updatedDomains = [...domains, trimmed];
    saveDomains(updatedDomains);
    setNewDomain("");
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    const updatedDomains = domains.filter((d) => d !== domainToRemove);
    saveDomains(updatedDomains);
  };

  const saveDomains = (updatedDomains: string[]) => {
    startTransition(async () => {
      const result = await updateOrganizationDomains(updatedDomains);
      if (result.success) {
        setDomains(updatedDomains);
        toast.success(result.message || t("settings.domains.toast.updated"));
      } else {
        toast.error(result.message || t("settings.domains.toast.saveFailed"));
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddDomain();
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="border-border dark:border-border rounded-md shadow-none">
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-3">
            <span className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
              <Globe className="size-5" />
            </span>
            {t("settings.domains.title")}
          </CardTitle>
          <CardDescription>{t("settings.domains.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary domain (cannot be deleted) - highlighted with info-muted */}
          {primaryDomain && (
            <div className="tonal-info flex min-w-0 items-center justify-between rounded-md px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Badge
                  variant="default"
                  className="max-w-full truncate"
                  title={primaryDomain}
                >
                  {primaryDomain}
                </Badge>
                <span className="shrink-0 text-[0.8125rem]">
                  {t("settings.domains.primary")}
                </span>
              </div>
            </div>
          )}

          {/* Add-domain input */}
          <div className="flex min-w-0 gap-2">
            <Input
              className="min-w-0 flex-1"
              placeholder={t("settings.domains.addPlaceholder")}
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isPending}
            />
            <Button
              type="button"
              onClick={handleAddDomain}
              disabled={isPending || !newDomain.trim()}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Additional domain list */}
          {domains.length === 0 ? (
            <div className="bg-muted flex flex-col items-center justify-center gap-1 rounded-md py-8 text-center">
              <span className="tonal-neutral mb-2 flex size-10 items-center justify-center rounded-md">
                <Globe className="size-5" />
              </span>
              <p className="text-muted-foreground text-[0.9375rem]">
                {t("settings.domains.empty.title")}
              </p>
              <p className="text-muted-foreground text-[0.8125rem]">
                {t("settings.domains.empty.description")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div
                  key={domain}
                  className="hover:bg-accent/60 flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge
                      variant="primary"
                      className="max-w-full truncate"
                      title={domain}
                    >
                      {domain}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDomain(domain)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Domain count */}
          {domains.length > 0 && (
            <p className="text-muted-foreground text-[0.8125rem]">
              {t("settings.domains.count", { count: domains.length })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
