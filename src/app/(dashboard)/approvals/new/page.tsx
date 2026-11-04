// src/app/(dashboard)/approvals/new/page.tsx
import { getApprovalFormOptions } from "@/actions/approvals/form-options";
import { ApprovalRequestForm } from "@/components/approvals/approval-request-form";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "New approval request" };

export default async function NewApprovalPage() {
  await requirePermissionOrRedirect("approvals:create", "/approvals");
  const options = await getApprovalFormOptions();
  if (!options.success || !options.data) redirect("/approvals");
  return <ApprovalRequestForm options={options.data} />;
}
