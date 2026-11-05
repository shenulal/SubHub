// src/components/auth/apple-sign-in-button.tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppleSignInButtonProps {
  /** Server action that calls `signIn("apple", …)` */
  action: () => Promise<void>;
  label: string;
  className?: string;
  style?: React.CSSProperties;
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.365 1.43c0 1.14-.47 2.26-1.21 3.07-.79.9-2.08 1.57-3.21 1.5-.14-1.14.42-2.33 1.17-3.08.8-.88 2.16-1.52 3.25-1.49zM20.84 17.3c-.52 1.2-.77 1.73-1.44 2.79-.93 1.47-2.25 3.3-3.88 3.32-1.45.01-1.82-.95-3.79-.94-1.97.01-2.38.95-3.83.93-1.63-.02-2.88-1.67-3.81-3.14C1.49 16.1.96 11.27 2.9 8.63c1.26-1.79 3.19-2.91 5.04-2.91 1.88 0 3.06 1.04 4.62 1.04 1.51 0 2.43-1.05 4.6-1.05 1.63 0 3.36.89 4.6 2.42-4.04 2.21-3.38 7.98-.92 9.17z" />
    </svg>
  );
}

/** "Continue with Apple" — rendered only when APPLE_CLIENT_ID is configured. */
export function AppleSignInButton({
  action,
  label,
  className,
  style,
}: AppleSignInButtonProps) {
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="outline"
        className={cn("w-full whitespace-nowrap", className)}
        style={style}
      >
        <AppleIcon className="size-[18px] shrink-0" />
        {label}
      </Button>
    </form>
  );
}
