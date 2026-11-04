// src/components/common/can.tsx
"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { ReactNode } from "react";

interface CanProps {
  permission: PermissionKey | PermissionKey[];
  mode?: "all" | "any";
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders children only when the current user holds the permission(s). */
export function Can({
  permission,
  mode = "all",
  fallback = null,
  children,
}: CanProps) {
  const { can, isLoading } = usePermissions();
  if (isLoading) return null;
  return can(permission, mode) ? <>{children}</> : <>{fallback}</>;
}
