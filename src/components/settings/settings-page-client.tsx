"use client";

import { useGetIdentity } from "@refinedev/core";
import { Building2, Mail, Shield, User } from "lucide-react";
import { useTranslations } from "next-intl";

interface SettingsPageClientProps {
  fallbackUser: {
    id: string;
    email: string;
    name?: string | null;
    organizationId?: string | null;
    role?: string | null;
  };
}

export function SettingsPageClient({ fallbackUser }: SettingsPageClientProps) {
  const t = useTranslations();
  const { data: identity, isLoading } = useGetIdentity<typeof fallbackUser>({
    queryOptions: {
      enabled: true,
      initialData: fallbackUser,
    },
  });

  const user = identity ?? fallbackUser;

  const getRoleLabel = (role: string | null | undefined) => {
    switch (role) {
      case "ADMIN":
        return t("settings.roles.admin");
      case "MEMBER":
        return t("settings.roles.member");
      case "VIEWER":
        return t("settings.roles.viewer");
      default:
        return t("settings.roles.unknown");
    }
  };

  return (
    <div className="space-y-5" data-loading={isLoading ? "true" : "false"}>
      <div>
        <h3 className="text-foreground text-lg leading-snug font-medium">
          {t("settings.overview.title")}
        </h3>
        <p className="text-muted-foreground text-[0.8125rem]">
          {t("settings.overview.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-4 rounded-md border p-4">
          <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <User className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
              {t("settings.fields.name")}
            </p>
            <p className="text-foreground truncate text-[0.9375rem] font-medium">
              {user?.name || t("settings.fields.nameEmpty")}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-4 rounded-md border p-4">
          <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
              {t("settings.fields.email")}
            </p>
            <p
              className="text-foreground truncate text-[0.9375rem] font-medium"
              title={user?.email}
            >
              {user?.email}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-4 rounded-md border p-4">
          <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Building2 className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
              {t("settings.fields.organizationId")}
            </p>
            <p className="text-foreground truncate font-mono text-[0.9375rem] font-medium">
              {user?.organizationId
                ? `${user.organizationId.slice(0, 8)}...`
                : t("settings.fields.organizationIdEmpty")}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-4 rounded-md border p-4">
          <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-md">
            <Shield className="size-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-muted-foreground truncate text-xs tracking-wide uppercase">
              {t("settings.fields.role")}
            </p>
            <p className="text-foreground truncate text-[0.9375rem] font-medium">
              {getRoleLabel(user?.role)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
