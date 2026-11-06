// src/app/super-admin/layout.tsx
/**
 * SubHub Control Panel root. Holds only the providers and the title template;
 * the guarded shell lives in `(console)/layout.tsx` so `/super-admin/login`
 * stays reachable without a session.
 */
import { ClientProviders } from "@/components/providers/client-providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | SubHub Control Panel",
    default: "SubHub Control Panel",
  },
};

export default function ControlPanelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientProviders>{children}</ClientProviders>;
}
