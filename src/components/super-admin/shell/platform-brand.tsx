// src/components/super-admin/shell/platform-brand.tsx
/** "SubHub Control Panel" lock-up with the Platform chip (distinct from the tenant app). */
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

export function PlatformBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-md shadow-md">
        <ShieldCheck className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-foreground truncate text-[0.9375rem] leading-tight font-semibold">
          SubHub
        </p>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground truncate text-[0.8125rem]">
            Control Panel
          </span>
          <span className="tonal-primary rounded px-1.5 py-px text-[0.6875rem] font-semibold tracking-wide uppercase">
            Platform
          </span>
        </div>
      </div>
    </div>
  );
}
