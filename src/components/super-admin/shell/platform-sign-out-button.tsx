"use client";

/** Signs the platform operator out and returns to the Control Panel sign-in. */
import { PLATFORM_LOGIN_PATH } from "@/lib/platform/identity";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function PlatformSignOutButton({
  className,
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label || "Sign out"}
      onClick={() => signOut({ callbackUrl: PLATFORM_LOGIN_PATH })}
      className={cn(
        "text-foreground/80 hover:bg-error/15 hover:text-error focus-visible:ring-ring flex h-10 items-center gap-2.5 rounded-md px-3 text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className
      )}
    >
      <LogOut className="size-[18px] shrink-0" />
      {label}
    </button>
  );
}
