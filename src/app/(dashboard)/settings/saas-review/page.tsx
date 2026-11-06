// src/app/(dashboard)/settings/saas-review/page.tsx
import { getInferenceMetrics } from "@/actions/inference-insights";
import { getSaasReviewData } from "@/actions/saas-review";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";
import { SaasReviewDashboard } from "./saas-review-dashboard";

export const metadata: Metadata = {
  title: "SaaS Review & Approval",
  description: "Review and approve SaaS discovered by the LLM",
};

export default async function SaasReviewPage() {
  await requirePermissionOrRedirect("apps:manage", "/settings");

  const [data, inferenceMetrics] = await Promise.all([
    getSaasReviewData(),
    getInferenceMetrics(),
  ]);

  return (
    <SaasReviewDashboard data={data} inferenceMetrics={inferenceMetrics} />
  );
}
