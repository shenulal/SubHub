"use client";

/**
 * Cancellation tab: vendor guide (catalog + app override, taxonomy area) plus
 * the subscription-specific override owned here.
 */
import { setSubscriptionCancellationOverride } from "@/actions/subscriptions/subscription-cancellation";
import { Can } from "@/components/common/can";
import { CancellationGuide } from "@/components/taxonomy/cancellation-guide";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";
import { ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface SubscriptionDetailCancellationProps {
  subscriptionId: string;
  appId: string;
  catalog: CatalogItemDto | null;
  appOverride: AppCancellationOverride | null;
  noticePeriodDays: number | null;
  cancellationUrl: string | null;
  cancellationNotes: string | null;
}

export function SubscriptionDetailCancellation({
  subscriptionId,
  appId,
  catalog,
  appOverride,
  noticePeriodDays,
  cancellationUrl,
  cancellationNotes,
}: SubscriptionDetailCancellationProps) {
  const t = useTranslations("lifecycle.cancellation");
  const router = useRouter();
  const [url, setUrl] = useState(cancellationUrl ?? "");
  const [notes, setNotes] = useState(cancellationNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    const result = await setSubscriptionCancellationOverride(subscriptionId, {
      cancellationUrl: url,
      cancellationNotes: notes,
    });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error ?? t("save"));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <CancellationGuide
        subscriptionId={subscriptionId}
        appId={appId}
        catalog={catalog}
        appOverride={appOverride}
        noticePeriodDays={noticePeriodDays}
        onUpdated={() => router.refresh()}
      />

      <Card className="border-border/50 rounded-sm shadow-sm">
        <CardHeader>
          <CardTitle>{t("overrideTitle")}</CardTitle>
          <CardDescription>{t("overrideDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(cancellationUrl || cancellationNotes) && (
            <div className="bg-muted/40 space-y-2 rounded-md border px-3 py-2 text-sm">
              {cancellationUrl && (
                <a
                  href={cancellationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {t("url")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {cancellationNotes && (
                <p className="whitespace-pre-wrap">{cancellationNotes}</p>
              )}
            </div>
          )}
          <Can permission="subscriptions:update">
            <div className="space-y-2">
              <Label htmlFor="sub-cancel-url">{t("url")}</Label>
              <Input
                id="sub-cancel-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-cancel-notes">{t("notes")}</Label>
              <Textarea
                id="sub-cancel-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void save()} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("save")}
              </Button>
            </div>
          </Can>
        </CardContent>
      </Card>
    </div>
  );
}
