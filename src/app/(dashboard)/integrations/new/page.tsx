// src/app/(dashboard)/integrations/new/page.tsx
import { IntegrationCreateForm } from "@/components/integrations/integration-create-form";
import { requirePermissionOrRedirect } from "@/lib/rbac/service";

export default async function NewIntegrationPage() {
  await requirePermissionOrRedirect("integrations:manage", "/integrations");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Integration</h1>
        <p className="text-muted-foreground">
          Register a new IdP/SSO integration
        </p>
      </div>

      <IntegrationCreateForm />
    </div>
  );
}
