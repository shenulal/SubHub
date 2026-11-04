// src/lib/services/discovery/scope-cookie.ts
/** Cookie that carries the Workspace | Personal scope (client-readable). */
import { WORKSPACE_SCOPES, type WorkspaceScope } from "@/types/discovery";

export const SCOPE_COOKIE = "subhub_scope";
export const DEFAULT_SCOPE: WorkspaceScope = "workspace";

export function isWorkspaceScope(value: unknown): value is WorkspaceScope {
  return (
    typeof value === "string" &&
    (WORKSPACE_SCOPES as readonly string[]).includes(value)
  );
}

/** Read the scope from a `document.cookie` string (client-side fast path). */
export function readScopeCookie(cookieString: string): WorkspaceScope | null {
  const match = cookieString
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SCOPE_COOKIE}=`));
  const value = match ? decodeURIComponent(match.split("=")[1] ?? "") : null;
  return isWorkspaceScope(value) ? value : null;
}
