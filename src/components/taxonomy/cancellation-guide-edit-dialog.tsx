// src/components/taxonomy/cancellation-guide-edit-dialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  setAppCancellationOverride,
  updateCatalogItem,
} from "@/actions/taxonomy/catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppCancellationOverride, CatalogItemDto } from "@/types/taxonomy";

interface CatalogEditProps {
  mode: "catalog";
  catalog: CatalogItemDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface OverrideEditProps {
  mode: "override";
  appId: string;
  appOverride: AppCancellationOverride | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export type CancellationGuideEditDialogProps =
  | CatalogEditProps
  | OverrideEditProps;

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function CancellationGuideEditDialog(
  props: CancellationGuideEditDialogProps
) {
  const t = useTranslations("taxonomy.cancellation");
  const tc = useTranslations("taxonomy.common");
  const [isSaving, setIsSaving] = useState(false);
  const initial = props.mode === "catalog" ? props.catalog : props.appOverride;
  const [cancellationUrl, setCancellationUrl] = useState(
    initial?.cancellationUrl ?? ""
  );
  const [billingPortalUrl, setBillingPortalUrl] = useState(
    props.mode === "catalog" ? (props.catalog.billingPortalUrl ?? "") : ""
  );
  const [steps, setSteps] = useState(
    props.mode === "catalog" ? props.catalog.cancellationSteps.join("\n") : ""
  );
  const [noticeDays, setNoticeDays] = useState(
    props.mode === "catalog" ? String(props.catalog.noticePeriodDays ?? "") : ""
  );
  const [notes, setNotes] = useState(
    props.mode === "override"
      ? (props.appOverride?.cancellationNotes ?? "")
      : ""
  );

  const submit = async () => {
    setIsSaving(true);
    const result =
      props.mode === "catalog"
        ? await updateCatalogItem(props.catalog.id, {
            cancellationUrl: cancellationUrl || null,
            billingPortalUrl: billingPortalUrl || null,
            cancellationSteps: splitLines(steps),
            noticePeriodDays: noticeDays ? Number(noticeDays) : null,
          })
        : await setAppCancellationOverride(props.appId, {
            cancellationUrl: cancellationUrl || null,
            cancellationNotes: notes || null,
          });
    setIsSaving(false);
    if (!result.success) {
      toast.error(result.error ?? tc("errorGeneric"));
      return;
    }
    toast.success(t("saved"));
    props.onOpenChange(false);
    props.onSaved?.();
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {props.mode === "catalog" ? t("editTitle") : t("editOverrideTitle")}
          </DialogTitle>
          <DialogDescription>
            {props.mode === "catalog"
              ? t("sourceCatalog")
              : t("sourceOverride")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cg-url">{t("cancellationUrlLabel")}</Label>
            <Input
              id="cg-url"
              type="url"
              value={cancellationUrl}
              onChange={(e) => setCancellationUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          {props.mode === "catalog" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="cg-portal">{t("billingPortalUrlLabel")}</Label>
                <Input
                  id="cg-portal"
                  type="url"
                  value={billingPortalUrl}
                  onChange={(e) => setBillingPortalUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cg-steps">{t("stepsLabel")}</Label>
                <Textarea
                  id="cg-steps"
                  rows={5}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cg-notice">{t("noticeLabel")}</Label>
                <Input
                  id="cg-notice"
                  type="number"
                  min={0}
                  max={365}
                  value={noticeDays}
                  onChange={(e) => setNoticeDays(e.target.value)}
                  className="w-32"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="cg-notes">{t("notesLabel")}</Label>
              <Textarea
                id="cg-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => props.onOpenChange(false)}
            disabled={isSaving}
          >
            {tc("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={isSaving}>
            {isSaving ? tc("saving") : tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
