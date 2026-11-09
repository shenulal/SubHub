// src/components/common/quick-create/create-app-details.tsx
"use client";

/**
 * Owner, teams, tags and description fields of the Create app dialog. Rendered
 * as direct children of the dialog's two-column grid (owner | teams, then tags
 * and description across both columns).
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
import { useTranslations } from "next-intl";

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
  disabled?: boolean;
}

export function CreateAppDetails({
  value,
  onChange,
  options,
  disabled,
}: Props) {
  const t = useTranslations("shell.createApp");
  return (
    <>
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
      <div className="grid min-w-0 gap-1.5 sm:col-span-2">
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
      <div className="grid min-w-0 gap-1.5 sm:col-span-2">
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
    </>
  );
}
