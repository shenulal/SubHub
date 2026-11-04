// src/app/(dashboard)/subscriptions/pipeline/page.client.tsx
"use client";

import { RenewalPipeline } from "@/components/subscriptions/renewal-pipeline";
import type { RenewalPipelineData } from "@/types/discovery";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  data: RenewalPipelineData;
  initialView: "board" | "list";
}

export function RenewalPipelinePageClient({ data, initialView }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onViewChange = useCallback(
    (view: "board" | "list") => {
      const params = new URLSearchParams(searchParams.toString());
      if (view === "list") params.set("view", "list");
      else params.delete("view");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <RenewalPipeline
      data={data}
      initialView={initialView}
      onViewChange={onViewChange}
    />
  );
}
