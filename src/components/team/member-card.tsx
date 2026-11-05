// src/components/team/member-card.tsx
"use client";

import { removeMember, updateMemberRole } from "@/actions/team-members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserRole } from "@prisma/client";
import {
  Eye,
  LogOut,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  User,
  UserMinus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import React, { useState, useTransition } from "react";

import { OffboardUserDialog } from "@/components/users/offboard-user-dialog";
import { TransferAdminDialog } from "./transfer-admin-dialog";

interface MemberCardProps {
  member: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    status: string;
    image: string | null;
  };
  members: Array<{
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
    status: string;
    image: string | null;
  }>;
  currentUserId: string;
  isAdmin: boolean;
}

const roleIcons: Record<UserRole, typeof Shield> = {
  SUPER_ADMIN: Shield,
  ADMIN: Shield,
  APPROVER: Shield,
  MEMBER: User,
  VIEWER: Eye,
};

// Status Colors 매핑 (color-theme-guide.md 기준)
// INACTIVE: warning-muted (일시적, 복구 가능)
// TERMINATED: destructive-muted (영구적)
// PENDING: info-muted (대기 중)
type StatusStyle = {
  variant: "secondary" | "warning" | "info" | "error";
};

const getStatusStyle = (status: string): StatusStyle => {
  switch (status) {
    case "INACTIVE":
      return { variant: "warning" };
    case "TERMINATED":
      return { variant: "error" };
    case "PENDING":
      return { variant: "info" };
    default:
      return { variant: "secondary" };
  }
};

export function MemberCard({
  member,
  members,
  currentUserId,
  isAdmin,
}: MemberCardProps) {
  const t = useTranslations("teamMembers.memberCard");
  const [isPending, startTransition] = useTransition();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showOffboardDialog, setShowOffboardDialog] = useState(false);
  const isCurrentUser = member.id === currentUserId;

  const getRoleLabel = (role: UserRole): string => {
    return t(`roles.${role.toLowerCase()}`);
  };

  const getStatusLabel = (status: string): string => {
    return t(`status.${status.toLowerCase()}`);
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (newRole === member.role) return;

    startTransition(async () => {
      await updateMemberRole({ userId: member.id, role: newRole });
    });
  };

  const handleRemove = () => {
    if (!confirm(t("removeConfirm", { name: member.name || member.email }))) {
      return;
    }

    startTransition(async () => {
      await removeMember(member.id);
    });
  };

  const RoleIcon = roleIcons[member.role];

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-md border p-4">
        <div className="flex min-w-0 items-center gap-3">
          {member.image ? (
            <Image
              src={member.image}
              alt={member.name || ""}
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="tonal-primary flex size-10 shrink-0 items-center justify-center rounded-full font-medium">
              {(member.name || member.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">
              {member.name || member.email}
              {isCurrentUser && (
                <span className="text-muted-foreground ml-2 text-sm">
                  ({t("me")})
                </span>
              )}
            </p>
            <p className="text-muted-foreground truncate text-[0.8125rem]">
              {member.email}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={member.role === "ADMIN" ? "primary" : "secondary"}>
            <RoleIcon className="mr-1 h-3 w-3" />
            {getRoleLabel(member.role)}
          </Badge>
          {member.status !== "ACTIVE" && (
            <Badge variant={getStatusStyle(member.status).variant}>
              {getStatusLabel(member.status)}
            </Badge>
          )}
          {isAdmin && !isCurrentUser && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isPending}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("changeRole")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(roleIcons) as UserRole[]).map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    disabled={isPending || member.role === role}
                  >
                    {React.createElement(roleIcons[role], {
                      className: "mr-2 h-4 w-4",
                    })}
                    {getRoleLabel(role)}
                    {member.role === role && (
                      <span className="text-muted-foreground ml-2">
                        ({t("current")})
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {isCurrentUser ? null : (
                  <>
                    <DropdownMenuItem
                      onClick={() => setShowTransferDialog(true)}
                      disabled={isPending}
                    >
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      {t("transferAdmin")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleRemove}
                      disabled={isPending}
                      className="text-destructive"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      {t("removeFromTeam")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowOffboardDialog(true)}
                      disabled={isPending || member.status === "TERMINATED"}
                      className="text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("offboardUser")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <TransferAdminDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        members={members}
        currentUserId={currentUserId}
      />

      <OffboardUserDialog
        open={showOffboardDialog}
        onOpenChange={setShowOffboardDialog}
        user={member}
      />
    </>
  );
}
