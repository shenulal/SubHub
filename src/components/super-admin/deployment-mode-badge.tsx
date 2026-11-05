// src/components/super-admin/deployment-mode-badge.tsx
/** Read-only deployment mode chip (SUBHUB_DEPLOYMENT_MODE). */
import type { DeploymentInfo } from "@/lib/deployment/mode";
import { cn } from "@/lib/utils";
import { Cloud, Server } from "lucide-react";

export function DeploymentModeBadge({
  deployment,
  className,
}: {
  deployment: DeploymentInfo;
  className?: string;
}) {
  const Icon = deployment.multiTenant ? Cloud : Server;
  return (
    <div
      data-testid="deployment-mode-badge"
      title={`Deployment mode: ${deployment.label}`}
      className={cn(
        deployment.multiTenant ? "tonal-primary" : "tonal-info",
        "flex min-w-0 items-center gap-2 rounded-md px-3 py-2",
        className
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate text-xs font-medium">{deployment.label}</span>
    </div>
  );
}
