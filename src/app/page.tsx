// src/app/page.tsx
// Root page - redirects to the appropriate page based on auth state

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Root page
 * - Unauthenticated → /login
 * - No organization → /onboarding
 * - Has organization → /apps
 */
export default async function RootPage() {
  const session = await auth();

  // Unauthenticated users go to the login page
  if (!session?.user) {
    redirect("/login");
  }

  // SUPER_ADMIN goes to the super-admin page
  if ((session.user.role as string) === "SUPER_ADMIN") {
    redirect("/super-admin");
  }

  // Users without an organization go to onboarding
  if (!session.user.organizationId) {
    redirect("/onboarding");
  }

  // Users with an organization go to the dashboard
  redirect("/dashboard");
}
