/**
 * Authentication layout — Materio "auth v1" composition
 * (themeselection/materio-mui-nextjs-admin-template-free, MIT):
 * a centred 450px card with the brand mark, over the body colour,
 * with the mask wave and tree illustrations along the bottom edge (md+).
 */
import Link from "next/link";

import { SubHubLogo } from "@/components/brand/subhub-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
      <div
        className="bg-card relative z-10 flex w-full flex-col rounded-lg shadow-md sm:w-[450px]"
        style={{ animation: "auth-fade-up 0.5s ease-out both" }}
      >
        <div className="p-6 sm:p-12">
          <Link
            href="/login"
            className="mb-6 flex items-center justify-center"
            aria-label="SubHub"
          >
            <SubHubLogo />
          </Link>
          {children}
        </div>
      </div>

      <p className="text-muted-foreground relative z-10 mt-6 text-center text-[0.8125rem]">
        © {new Date().getFullYear()} SubHub ·{" "}
        <span className="text-primary font-medium">HelloPixels</span>
      </p>

      <AuthIllustrations />
    </div>
  );
}

/** Materio mask wave + trees, hidden below the md breakpoint as in the template. */
function AuthIllustrations() {
  return (
    <div aria-hidden className="pointer-events-none hidden md:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/materio/auth-v1-mask-light.png"
        alt=""
        className="absolute inset-x-0 bottom-0 -z-10 w-full dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/materio/auth-v1-mask-dark.png"
        alt=""
        className="absolute inset-x-0 bottom-0 -z-10 hidden w-full dark:block"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/materio/tree-1.png"
        alt=""
        height={200}
        className="absolute bottom-0 left-0 h-[200px] w-auto"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/materio/tree-2.png"
        alt=""
        height={200}
        className="absolute right-0 bottom-0 h-[200px] w-auto"
      />
    </div>
  );
}
