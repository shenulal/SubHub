// src/components/devices/devices-users-alert.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserX } from "lucide-react";
import { useTranslations } from "next-intl";

interface UserWithoutAgent {
  id: string;
  name: string | null;
  email: string;
}

interface DevicesUsersAlertProps {
  usersWithoutAgent: UserWithoutAgent[];
  onShowInstallGuide: () => void;
}

export function DevicesUsersAlert({
  usersWithoutAgent,
  onShowInstallGuide,
}: DevicesUsersAlertProps) {
  const t = useTranslations("devices.usersAlert");
  if (usersWithoutAgent.length === 0) {
    return null;
  }

  return (
    <div className="border-warning/40 bg-warning/[0.08] mx-5 mt-5 rounded-md border p-4 sm:mx-6">
      <div className="text-foreground flex items-center gap-3 text-[0.9375rem] font-medium">
        <span className="tonal-warning flex size-8 shrink-0 items-center justify-center rounded-md">
          <UserX className="size-[18px]" />
        </span>
        <span className="min-w-0">
          {t("title", { count: usersWithoutAgent.length })}
        </span>
      </div>
      <div className="mt-3 mb-3 flex flex-wrap gap-2">
        {usersWithoutAgent.slice(0, 5).map((user) => (
          <Badge
            key={user.id}
            variant="outline"
            className="bg-card border-warning/40 max-w-[220px] truncate"
          >
            {user.name || user.email}
          </Badge>
        ))}
        {usersWithoutAgent.length > 5 && (
          <Badge variant="outline" className="bg-card border-warning/40">
            {t("more", { count: usersWithoutAgent.length - 5 })}
          </Badge>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onShowInstallGuide}
        className="border-warning/50 text-warning hover:bg-warning/10 hover:text-warning bg-card"
      >
        {t("action")}
      </Button>
    </div>
  );
}
