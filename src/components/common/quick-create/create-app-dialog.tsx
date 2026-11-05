// src/components/common/quick-create/create-app-dialog.tsx
"use client";

/**
 * Compact "Create app" dialog used by every app/vendor picker and by the global
 * "+ New" menu. Wraps the existing `createApp` server action (which enforces
 * `apps:manage`), shows field errors under their inputs and blocks double submit.
 */
import { createApp } from "@/actions/apps";
import { CategoryPicker } from "@/components/taxonomy/category-picker";
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
import type { CatalogItemDto } from "@/types/taxonomy";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { CatalogLinkField } from "./catalog-link-field";
import { FieldError, RequiredMark } from "./form-bits";

export interface CreatedApp {
  id: string;
  name: string;
  categoryId: string | null;
  website: string | null;
}

export interface CreateAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the name (the text typed in the picker). */
  defaultName?: string;
  onCreated?: (app: CreatedApp) => void;
  /** Where focus goes when the dialog closes (the picker that opened it). */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

interface Draft {
  name: string;
  categoryId: string | null;
  website: string;
  catalog: CatalogItemDto | null;
}

type Errors = Partial<Record<"name" | "website" | "form", string>>;

const MIN_NAME_LENGTH = 2;

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toFormData(draft: Draft): FormData {
  const fd = new FormData();
  fd.append("name", draft.name.trim());
  if (draft.categoryId) fd.append("categoryId", draft.categoryId);
  if (draft.website.trim()) fd.append("customWebsite", draft.website.trim());
  if (draft.catalog) {
    fd.append("catalogId", draft.catalog.id);
    if (draft.catalog.logoUrl)
      fd.append("customLogoUrl", draft.catalog.logoUrl);
  }
  return fd;
}

const emptyDraft = (name = ""): Draft => ({
  name,
  categoryId: null,
  website: "",
  catalog: null,
});

export function CreateAppDialog({
  open,
  onOpenChange,
  defaultName,
  onCreated,
  returnFocusRef,
}: CreateAppDialogProps) {
  const t = useTranslations("shell.createApp");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultName));
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft(defaultName));
      setErrors({});
    }
  }, [open, defaultName]);

  const validate = (): Errors => {
    const next: Errors = {};
    if (draft.name.trim().length < MIN_NAME_LENGTH)
      next.name = t("nameTooShort");
    if (!isValidUrl(draft.website.trim())) next.website = t("invalidUrl");
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Dialogs are often rendered inside another form; keep its submit untouched.
    event.stopPropagation();
    if (savingRef.current) return;
    const local = validate();
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      const result = await createApp({ success: false }, toFormData(draft));
      if (!result.success || !result.data) {
        setErrors({
          name: result.errors?.name?.[0],
          website: result.errors?.customWebsite?.[0],
          form: result.message ?? (result.errors ? undefined : t("error")),
        });
        if (result.message) toast.error(result.message);
        return;
      }
      const created: CreatedApp = {
        id: result.data.id,
        name: draft.name.trim(),
        categoryId: draft.categoryId,
        website: draft.website.trim() || draft.catalog?.website || null,
      };
      toast.success(t("success", { name: created.name }));
      onCreated?.(created);
      onOpenChange(false);
    } catch {
      setErrors({ form: t("error") });
      toast.error(t("error"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const pickCatalog = (item: CatalogItemDto | null) =>
    setDraft((d) => ({
      ...d,
      catalog: item,
      website: item?.website && !d.website ? item.website : d.website,
    }));

  return (
    <Dialog open={open} onOpenChange={(o) => !isSaving && onOpenChange(o)}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef?.current;
          if (!target) return;
          event.preventDefault();
          target.focus();
        }}
      >
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label htmlFor="create-app-name">
              {t("name")}
              <RequiredMark />
            </Label>
            <Input
              id="create-app-name"
              autoFocus
              value={draft.name}
              placeholder={t("namePlaceholder")}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={
                errors.name ? "create-app-name-error" : undefined
              }
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              disabled={isSaving}
            />
            <FieldError id="create-app-name-error" message={errors.name} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="create-app-category">{t("category")}</Label>
            <CategoryPicker
              id="create-app-category"
              value={draft.categoryId}
              onChange={(id) => setDraft((d) => ({ ...d, categoryId: id }))}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="create-app-website">{t("website")}</Label>
            <Input
              id="create-app-website"
              type="url"
              inputMode="url"
              value={draft.website}
              placeholder={t("websitePlaceholder")}
              aria-invalid={Boolean(errors.website)}
              aria-describedby={
                errors.website ? "create-app-website-error" : undefined
              }
              onChange={(e) =>
                setDraft((d) => ({ ...d, website: e.target.value }))
              }
              disabled={isSaving}
            />
            <FieldError
              id="create-app-website-error"
              message={errors.website}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="create-app-catalog">{t("catalog")}</Label>
            <CatalogLinkField
              id="create-app-catalog"
              value={draft.catalog}
              onChange={pickCatalog}
              initialQuery={defaultName}
              disabled={isSaving}
            />
          </div>

          <FieldError message={errors.form} />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSaving ? t("creating") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
