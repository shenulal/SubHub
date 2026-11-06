// src/components/common/quick-create/app-icon-field.tsx
"use client";

/**
 * Compact icon picker for the quick-create app dialog: upload an image (sent
 * as a data URL and stored server-side), paste an image URL, or fall back to
 * the linked catalog logo. The server re-validates type and size.
 */
import { AppLogo } from "@/components/apps/app-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type ChangeEvent } from "react";

export const APP_ICON_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

const BYTES_PER_KB = 1024;

interface AppIconFieldProps {
  id: string;
  name: string;
  /** Uploaded data URL or typed URL ("" = none). */
  value: string;
  onChange: (value: string) => void;
  catalog?: { name: string; logoUrl: string | null } | null;
  maxSizeKb?: number;
  disabled?: boolean;
  onError: (message: string | undefined) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AppIconField({
  id,
  name,
  value,
  onChange,
  catalog,
  maxSizeKb,
  disabled,
  onError,
}: AppIconFieldProps) {
  const t = useTranslations("shell.createApp");
  const inputRef = useRef<HTMLInputElement>(null);
  const isUpload = value.startsWith("data:");
  const preview = value || catalog?.logoUrl || null;

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(APP_ICON_TYPES as readonly string[]).includes(file.type)) {
      onError(t("iconTypeError"));
      return;
    }
    if (maxSizeKb && file.size > maxSizeKb * BYTES_PER_KB) {
      onError(t("iconSizeError", { kb: maxSizeKb }));
      return;
    }
    onError(undefined);
    onChange(await readAsDataUrl(file));
  };

  return (
    <div className="flex min-w-0 items-start gap-4">
      <AppLogo
        src={preview}
        name={name || "?"}
        className="size-16 rounded-lg p-1"
        fallbackClassName="text-2xl"
      />
      <div className="grid min-w-0 flex-1 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={APP_ICON_TYPES.join(",")}
            className="hidden"
            onChange={pick}
            disabled={disabled}
            data-testid="app-icon-file"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <ImagePlus className="mr-1.5 size-4" />
            {isUpload ? t("iconReplace") : t("iconUpload")}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={disabled}
            >
              <Trash2 className="mr-1.5 size-4" />
              {t("iconRemove")}
            </Button>
          )}
        </div>
        {!isUpload && (
          <Input
            id={id}
            type="url"
            inputMode="url"
            value={value}
            aria-label={t("iconUrl")}
            placeholder={t("iconUrlPlaceholder")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )}
        <p className="text-muted-foreground text-[0.8125rem]">
          {!value && catalog?.logoUrl
            ? t("iconCatalogHint", { name: catalog.name })
            : t("iconHint", { kb: maxSizeKb ?? "—" })}
        </p>
      </div>
    </div>
  );
}
