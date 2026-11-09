// src/app/(dashboard)/apps/new/page.tsx
// Apps are created in the one Create app dialog. This address is kept for old
// links and bookmarks: it opens the Apps list with that dialog already open.
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import { redirect } from "next/navigation";

/** Longest prefilled name accepted from `?name=` (matches the form's limit). */
const MAX_PREFILL_NAME = 100;

export default async function NewAppPage({
  searchParams,
}: {
  searchParams?: Promise<{ name?: string | string[] }>;
}) {
  await requirePermissionOrRedirect("apps:manage", "/apps");
  const params = (await searchParams) ?? {};
  const rawName = Array.isArray(params.name) ? params.name[0] : params.name;
  const name = rawName?.trim().slice(0, MAX_PREFILL_NAME);
  const query = new URLSearchParams({ create: "1" });
  if (name) query.set("name", name);
  redirect(`/apps?${query.toString()}`);
}
