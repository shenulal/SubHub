// src/app/(dashboard)/settings/approvals/page.tsx
import { getPolicyFormOptions } from "@/actions/approvals/form-options";
import { getApprovalPolicies } from "@/actions/approvals/policies";
import { PolicyManager } from "@/components/approvals/policy-manager";
import { TeamApproverSettings } from "@/components/approvals/team-approver-settings";
import { Separator } from "@/components/ui/separator";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Approval policies" };

export default async function ApprovalSettingsPage() {
  await requirePermissionOrRedirect("approval_policies:read", "/settings");
  const [policies, options] = await Promise.all([
    getApprovalPolicies(),
    getPolicyFormOptions(),
  ]);
  if (
    !policies.success ||
    !policies.data ||
    !options.success ||
    !options.data
  ) {
    return (
      <p className="text-destructive text-sm">
        {policies.error ?? options.error ?? "Unable to load approval settings"}
      </p>
    );
  }
  return (
    <div className="space-y-8">
      <PolicyManager policies={policies.data} options={options.data} />
      <Separator />
      <div className="max-w-2xl">
        <TeamApproverSettings />
      </div>
    </div>
  );
}
