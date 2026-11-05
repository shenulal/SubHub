// src/components/common/v2-coming-soon.tsx
import { Construction } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface V2ComingSoonProps {
  /** Feature name (e.g. "Kanban board", "Task management") */
  feature: string;
  /** Feature description (optional) */
  description?: string;
}

/**
 * V2 Coming Soon component
 * Shows a preview page for a feature planned for V2.
 */
export function V2ComingSoon({ feature, description }: V2ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="tonal-primary mb-6 flex size-24 items-center justify-center rounded-full">
        <Construction className="size-12" />
      </div>
      <h1 className="text-foreground mb-2 text-2xl font-medium">Coming Soon</h1>
      <p className="text-foreground mb-1 text-[0.9375rem]">{feature}</p>
      <p className="text-muted-foreground mb-6 text-center text-[0.8125rem]">
        {description || "This feature will be available in V2."}
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
