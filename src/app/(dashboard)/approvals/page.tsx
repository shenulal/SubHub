// src/app/(dashboard)/approvals/page.tsx
import {
  ApprovalsInboxClient,
  type InboxFilterOptions,
} from "@/components/approvals/approvals-inbox-client";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const { organizationId, permissions } =
    await requirePermissionOrRedirect("approvals:read");
  const canReadAll = permissions.has("approvals:read_all");
  const [categories, requesters] = await Promise.all([
    prisma.category.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    canReadAll
      ? prisma.user.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { id: true, name: true, email: true },
          orderBy: [{ name: "asc" }, { email: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  const options: InboxFilterOptions = { categories, requesters, canReadAll };
  return <ApprovalsInboxClient options={options} />;
}
