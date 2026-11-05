// src/hooks/use-deployment-info.ts
"use client";

import type { DeploymentInfo } from "@/lib/deployment/mode";
import { useQuery } from "@tanstack/react-query";

interface SystemInfoResponse {
  success: boolean;
  data?: { deployment: DeploymentInfo };
}

async function fetchDeploymentInfo(): Promise<DeploymentInfo | null> {
  const res = await fetch("/api/v1/system/info", { credentials: "include" });
  if (!res.ok) return null;
  const json = (await res.json()) as SystemInfoResponse;
  return json.data?.deployment ?? null;
}

/**
 * Deployment mode for client components (`SUBHUB_DEPLOYMENT_MODE` is server-only).
 * Server components should call `getDeploymentInfo()` and pass it down instead.
 */
export function useDeploymentInfo() {
  const query = useQuery({
    queryKey: ["system", "info"],
    queryFn: fetchDeploymentInfo,
    staleTime: Infinity,
  });
  return { deployment: query.data ?? null, isLoading: query.isLoading };
}
