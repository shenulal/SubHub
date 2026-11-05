// src/components/settings/profile-form.tsx
"use client";

import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Mail, User } from "lucide-react";
// MVP scope: avatar UI disabled (the backend only handles name)
// import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
// import {
//   AvatarPreviewGrid,
//   UserAvatar,
//   type AvatarVariant,
// } from "./user-avatar";

interface ProfileFormProps {
  defaultValues: {
    name: string;
    // MVP scope: avatar/title/department disabled
    title: string;
    department: string;
    avatarUrl: string;
  };
  userEmail?: string;
}

function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

// MVP scope: avatar utilities disabled
// function generateRandomSeed(): string {
//   return `avatar-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
// }
// function parseAvatarUrl(
//   url: string
// ): { variant: AvatarVariant; seed: string } | null {
//   if (!url || !url.startsWith("avatar://")) return null;
//   const [, rest] = url.split("://");
//   const [variant, seed] = rest?.split("/") ?? [];
//   if (!variant || !seed) return null;
//   return { variant: variant as AvatarVariant, seed };
// }

export function ProfileForm({ defaultValues, userEmail }: ProfileFormProps) {
  const t = useTranslations();
  const [state, formAction] = useActionState(updateProfile, {
    success: false,
  });

  // MVP scope: avatar state disabled
  // const parsedAvatar = parseAvatarUrl(defaultValues.avatarUrl);
  // const [avatarSeed, setAvatarSeed] = useState<string>(...);
  // const [selectedVariant, setSelectedVariant] = useState<AvatarVariant>(...);
  // const avatarValue = `avatar://${selectedVariant}/${avatarSeed}`;

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(state.message || t("settings.profile.toast.updated"));
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, t]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex min-w-0 items-center gap-4 border-b pb-5">
        <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <User className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-foreground text-lg leading-snug font-medium">
            {t("settings.profile.title")}
          </h3>
          <p className="text-muted-foreground text-[0.8125rem]">
            {t("settings.profile.description")}
          </p>
        </div>
      </div>

      <form action={formAction} className="space-y-6">
        {/* MVP scope: avatar picker section disabled (the backend only handles name) */}
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Name Field - Editable Section */}
          <div className="min-w-0 space-y-1.5">
            <div className="space-y-0.5">
              <Label htmlFor="name" className="text-[0.9375rem]">
                {t("settings.profile.fields.name")}
              </Label>
            </div>
            <Input
              id="name"
              name="name"
              defaultValue={defaultValues.name}
              required
            />
            {state?.errors?.name && (
              <p className="text-destructive text-[0.8125rem]">
                {state.errors.name.join(", ")}
              </p>
            )}
          </div>

          {/* Email Field - Info Notice Pattern (Read-only) */}
          {userEmail && (
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor="email"
                className="text-muted-foreground flex items-center gap-1.5 text-[0.9375rem]"
              >
                <Mail className="size-4 shrink-0" />
                {t("settings.profile.fields.email")}
              </Label>
              <Input
                id="email"
                value={userEmail}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
          )}

          {/* Department Field - Info Notice Pattern (Read-only) */}
          {defaultValues.department && (
            <div className="min-w-0 space-y-1.5">
              <Label
                htmlFor="department"
                className="text-muted-foreground flex items-center gap-1.5 text-[0.9375rem]"
              >
                <Building2 className="size-4 shrink-0" />
                {t("settings.profile.fields.department")}
              </Label>
              <Input
                id="department"
                value={defaultValues.department}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
          <SubmitButton
            idleLabel={t("settings.profile.actions.save")}
            pendingLabel={t("settings.profile.actions.saving")}
          />
        </div>
      </form>
    </div>
  );
}
