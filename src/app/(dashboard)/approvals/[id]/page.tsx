// src/app/(dashboard)/approvals/[id]/page.tsx
import { getApprovalRequest } from "@/actions/approvals/requests-read";
import { ApprovalDetailClient } from "@/components/approvals/approval-detail-client";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getApprovalRequest(id);
  return {
    title: result.data ? `${result.data.serviceName} · Approval` : "Approval",
  };
}

export default async function ApprovalDetailPage({ params }: PageProps) {
  await requirePermissionOrRedirect("approvals:read");
  const { id } = await params;
  const result = await getApprovalRequest(id);
  if (!result.success || !result.data) notFound();
  return <ApprovalDetailClient initial={result.data} />;
}
