// src/components/common/quick-create/create-app-details.tsx
"use client";

/**
 * "More details" section of the quick-create app dialog: owner, teams, tags
 * and notes, plus a link to the full app form for everything else.
 */
import type { AppFormOptions } from "@/actions/apps-form-options";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export interface AppDetailsDraft {
  ownerId: string | null;
  teamIds: string[];
  tags: string;
  notes: string;
}

export const EMPTY_DETAILS: AppDetailsDraft = {
  ownerId: null,
  teamIds: [],
  tags: "",
  notes: "",
};

const NO_OWNER = "__none__";
const NOTES_MAX = 1000;

interface Props {
  value: AppDetailsDraft;
  onChange: (patch: Partial<AppDetailsDraft>) => void;
  options: AppFormOptions | undefined;
  appName: string;
  disabled?: boolean;
}

export function CreateAppDetails({
  value,
  onChange,
  options,
  appName,
  disabled,
}: Props) {
  const t = useTranslations("shell.createApp");
  const fullFormHref = appName.trim()
    ? `/apps/new?name=${encodeURIComponent(appName.trim())}`
    : "/apps/new";
  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="create-app-owner">{t("owner")}</Label>
          <Select
            value={value.ownerId ?? NO_OWNER}
            onValueChange={(v) =>
              onChange({ ownerId: v === NO_OWNER ? null : v })
            }
            disabled={disabled || !options}
          >
            <SelectTrigger id="create-app-owner" className="w-full">
              <SelectValue placeholder={t("ownerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OWNER}>{t("noOwner")}</SelectItem>
              {options?.owners.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="create-app-teams">{t("teams")}</Label>
          <MultiSelect
            id="create-app-teams"
            options={(options?.teams ?? []).map((team) => ({
              value: team.id,
              label: team.name,
            }))}
            value={value.teamIds}
            onValueChange={(teamIds) => onChange({ teamIds })}
            placeholder={t("teamsPlaceholder")}
            disabled={disabled || !options}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="create-app-tags">{t("tags")}</Label>
        <Input
          id="create-app-tags"
          value={value.tags}
          placeholder={t("tagsPlaceholder")}
          onChange={(e) => onChange({ tags: e.target.value })}
          disabled={disabled}
        />
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("tagsHint")}
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="create-app-notes">{t("notes")}</Label>
        <Textarea
          id="create-app-notes"
          rows={2}
          maxLength={NOTES_MAX}
          value={value.notes}
          placeholder={t("notesPlaceholder")}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled}
        />
      </div>
      <Link
        href={fullFormHref}
        target="_blank"
        rel="noopener"
        className="text-primary inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-medium hover:underline"
      >
        {t("fullForm")}
        <ExternalLink className="size-3.5" />
      </Link>
    </div>
  );
}
